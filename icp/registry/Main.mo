import Map "mo:core/Map";
import List "mo:core/List";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Array "mo:core/Array";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Iter "mo:core/Iter";

shared (install) persistent actor class Registry() {
  public type Entry = {
    recordedAt : Int;
    revokedAt : Int;
    encryptedCopy : Blob;
    seq : Nat;
  };

  public type RecordResult = {
    recorded : Nat;
    skipped : Nat;
    firstSeq : Nat;
    lastSeq : Nat;
    at : Int;
  };

  public type Summary = {
    seq : Nat;
    fingerprint : Text;
    recordedAt : Int;
    revokedAt : Int;
    encryptedBytes : Nat;
  };

  public type LogEntry = {
    id : Nat;
    action : Text;
    recordNo : Nat;
    fingerprint : Text;
    time : Text;
    at : Int;
    by : Principal;
    note : Text;
  };

  var owner : Principal = install.caller;
  let entries = Map.empty<Text, Entry>();
  var count : Nat = 0;
  let activity = List.empty<LogEntry>();
  let labels = Map.empty<Text, Text>();

  func requireOwner(caller : Principal) {
    if (caller != owner) Runtime.trap("Only the CertiChain registrar can write to this registry.");
  };

  func validFingerprint(h : Text) : Bool {
    h.size() == 66 and Text.startsWith(h, #text "0x");
  };

  func two(n : Int) : Text {
    if (n < 10) "0" # Int.toText(n) else Int.toText(n);
  };

  func phTime(ns : Int) : Text {
    let secs = ns / 1_000_000_000 + 8 * 3600;
    let days = secs / 86400;
    let rest = secs % 86400;
    let z = days + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if (mp < 10) mp + 3 else mp - 9;
    let y = yoe + era * 400 + (if (m <= 2) 1 else 0);
    Int.toText(y) # "-" # two(m) # "-" # two(d) # " " # two(rest / 3600) # ":" # two((rest % 3600) / 60) # ":" # two(rest % 60) # " PHT";
  };

  func log(action : Text, recordNo : Nat, fingerprint : Text, at : Int, by : Principal, note : Text) {
    List.add(activity, {
      id = List.size(activity) + 1;
      action;
      recordNo;
      fingerprint;
      time = phTime(at);
      at;
      by;
      note;
    });
  };

  public shared (msg) func restoreLog() : async Nat {
    requireOwner(msg.caller);
    if (List.size(activity) == 0 and count > 0) {
      let events = List.empty<(Int, Text, Nat, Text)>();
      for ((h, e) in Map.entries(entries)) {
        List.add(events, (e.recordedAt, "RECORDED", e.seq, h));
        if (e.revokedAt > 0) List.add(events, (e.revokedAt, "REVOKED", e.seq, h));
      };
      let sorted = Array.sort<(Int, Text, Nat, Text)>(List.toArray(events), func(a, b) {
        switch (Int.compare(a.0, b.0)) {
          case (#equal) Nat.compare(a.2, b.2);
          case (other) other;
        };
      });
      for ((at, action, no, h) in sorted.values()) {
        log(action, no, h, at, owner, "Restored into the activity log from the stored record");
      };
    };
    List.size(activity);
  };

  func putLabel(h : Text, value : Text) : Bool {
    let t = Text.trim(value, #char ' ');
    if (t.size() == 0 or t.size() > 240) return false;
    switch (Map.get(labels, Text.compare, h), Map.get(entries, Text.compare, h)) {
      case (null, ?_) { Map.add(labels, Text.compare, h, t); true };
      case _ false;
    };
  };

  func labelOrBlank(h : Text) : Text {
    switch (Map.get(labels, Text.compare, h)) { case (?t) t; case null "" };
  };

  public shared (msg) func recordLabeled(hashes : [Text], encryptedCopies : [Blob], texts : [Text]) : async RecordResult {
    requireOwner(msg.caller);
    if (hashes.size() != texts.size()) Runtime.trap("Each fingerprint needs exactly one label.");
    let result = recordInternal(msg.caller, hashes, encryptedCopies, texts);
    result;
  };

  public shared (msg) func setLabels(hashes : [Text], texts : [Text]) : async Nat {
    requireOwner(msg.caller);
    if (hashes.size() != texts.size()) Runtime.trap("Each fingerprint needs exactly one label.");
    var n = 0;
    var i = 0;
    while (i < hashes.size()) {
      if (putLabel(Text.toLower(hashes[i]), texts[i])) n += 1;
      i += 1;
    };
    n;
  };

  public shared (msg) func recordSealed(hashes : [Text], encryptedCopies : [Blob]) : async RecordResult {
    requireOwner(msg.caller);
    recordInternal(msg.caller, hashes, encryptedCopies, []);
  };

  func recordInternal(caller : Principal, hashes : [Text], encryptedCopies : [Blob], texts : [Text]) : RecordResult {
    if (hashes.size() != encryptedCopies.size()) Runtime.trap("Each fingerprint needs exactly one encrypted copy.");
    let now = Time.now();
    let first = count + 1;
    var recorded = 0;
    var skipped = 0;
    var i = 0;
    while (i < hashes.size()) {
      let h = Text.toLower(hashes[i]);
      if (not validFingerprint(h)) Runtime.trap("Invalid fingerprint: " # h);
      switch (Map.get(entries, Text.compare, h)) {
        case (?_) { skipped += 1 };
        case null {
          count += 1;
          Map.add(entries, Text.compare, h, { recordedAt = now; revokedAt = 0; encryptedCopy = encryptedCopies[i]; seq = count });
          let tag = if (i < texts.size() and putLabel(h, texts[i])) labelOrBlank(h) # " · " else "";
          log("RECORDED", count, h, now, caller, tag # "Fingerprint and AES-256 encrypted copy (" # Nat.toText(encryptedCopies[i].size()) # " bytes) stored");
          recorded += 1;
        };
      };
      if (i < texts.size()) ignore putLabel(h, texts[i]);
      i += 1;
    };
    { recorded; skipped; firstSeq = first; lastSeq = count; at = now };
  };

  public shared (msg) func revoke(hashes : [Text]) : async Nat {
    requireOwner(msg.caller);
    let now = Time.now();
    var revoked = 0;
    for (raw in hashes.values()) {
      let h = Text.toLower(raw);
      switch (Map.get(entries, Text.compare, h)) {
        case (?e) {
          if (e.revokedAt == 0) {
            Map.add(entries, Text.compare, h, { e with revokedAt = now });
            log("REVOKED", e.seq, h, now, msg.caller, "Credential revoked by the Registrar");
            revoked += 1;
          };
        };
        case null {};
      };
    };
    revoked;
  };

  public query func lookup(h : Text) : async ?Entry {
    Map.get(entries, Text.compare, Text.toLower(h));
  };

  public query func lookupMany(hashes : [Text]) : async [?Entry] {
    Array.map<Text, ?Entry>(hashes, func (h : Text) : ?Entry { Map.get(entries, Text.compare, Text.toLower(h)) });
  };

  public query func recent(limit : Nat) : async [Summary] {
    let all = Iter.toArray<(Text, Entry)>(Map.entries(entries));
    let newestFirst = Array.sort<(Text, Entry)>(all, func(a, b) { Nat.compare(b.1.seq, a.1.seq) });
    let n = if (limit < newestFirst.size()) limit else newestFirst.size();
    Array.tabulate<Summary>(n, func(i) {
      let (h, e) = newestFirst[i];
      { seq = e.seq; fingerprint = h; recordedAt = e.recordedAt; revokedAt = e.revokedAt; encryptedBytes = e.encryptedCopy.size() };
    });
  };

  public query func logCount() : async Nat {
    List.size(activity);
  };

  public query func logs(fromId : Nat, limit : Nat) : async [LogEntry] {
    let total = List.size(activity);
    let start = if (fromId == 0) 0 else fromId - 1;
    if (start >= total) return [];
    let n = if (limit < total - start) limit else total - start;
    Array.tabulate<LogEntry>(n, func(i) { List.at(activity, start + i) });
  };

  public query func latestLogs(limit : Nat) : async [LogEntry] {
    let total = List.size(activity);
    let n = if (limit < total) limit else total;
    Array.tabulate<LogEntry>(n, func(i) { List.at(activity, total - 1 - i) });
  };

  public query func historyOf(fingerprint : Text) : async [LogEntry] {
    let h = Text.toLower(fingerprint);
    List.toArray(List.filter<LogEntry>(activity, func(e) { e.fingerprint == h }));
  };

  public type RecordView = {
    recordNo : Nat;
    document : Text;
    status : Text;
    recorded : Text;
    revoked : Text;
    fingerprint : Text;
    encryptedCopyBytes : Nat;
  };

  public type LogView = {
    id : Nat;
    action : Text;
    recordNo : Nat;
    document : Text;
    time : Text;
    by : Principal;
    fingerprint : Text;
  };

  func viewOf(h : Text, e : Entry) : RecordView {
    {
      recordNo = e.seq;
      document = labelOrBlank(h);
      status = if (e.revokedAt > 0) "REVOKED" else "VALID";
      recorded = phTime(e.recordedAt);
      revoked = if (e.revokedAt > 0) phTime(e.revokedAt) else "";
      fingerprint = h;
      encryptedCopyBytes = e.encryptedCopy.size();
    };
  };

  func logView(e : LogEntry) : LogView {
    { id = e.id; action = e.action; recordNo = e.recordNo; document = labelOrBlank(e.fingerprint); time = e.time; by = e.by; fingerprint = e.fingerprint };
  };

  public query func records(fromNo : Nat, limit : Nat) : async [RecordView] {
    let all = Iter.toArray<(Text, Entry)>(Map.entries(entries));
    let bySeq = Array.sort<(Text, Entry)>(all, func(a, b) { Nat.compare(a.1.seq, b.1.seq) });
    let picked = Array.filter<(Text, Entry)>(bySeq, func(x) { x.1.seq >= fromNo });
    let n = if (limit < picked.size()) limit else picked.size();
    Array.tabulate<RecordView>(n, func(i) { viewOf(picked[i].0, picked[i].1) });
  };

  public query func readableLogs(fromId : Nat, limit : Nat) : async [LogView] {
    let total = List.size(activity);
    let start = if (fromId == 0) 0 else fromId - 1;
    if (start >= total) return [];
    let n = if (limit < total - start) limit else total - start;
    Array.tabulate<LogView>(n, func(i) { logView(List.at(activity, start + i)) });
  };

  public query func latestReadableLogs(limit : Nat) : async [LogView] {
    let total = List.size(activity);
    let n = if (limit < total) limit else total;
    Array.tabulate<LogView>(n, func(i) { logView(List.at(activity, total - 1 - i)) });
  };

  public query func labelOf(fingerprint : Text) : async Text {
    labelOrBlank(Text.toLower(fingerprint));
  };

  public query func getOwner() : async Principal {
    owner;
  };

  public query func stats() : async { count : Nat; owner : Principal; logEntries : Nat } {
    { count; owner; logEntries = List.size(activity) };
  };

  public shared (msg) func claimOwnership() : async () {
    if (not Principal.isController(msg.caller)) Runtime.trap("Only a controller of this canister can claim ownership.");
    let before = owner;
    owner := msg.caller;
    log("OWNER_CHANGED", 0, "", Time.now(), msg.caller, "Ownership claimed by a controller (previous owner " # Principal.toText(before) # ")");
  };

  public shared (msg) func transferOwnership(next : Principal) : async () {
    requireOwner(msg.caller);
    if (Principal.isAnonymous(next)) Runtime.trap("The new owner cannot be anonymous.");
    owner := next;
    log("OWNER_CHANGED", 0, "", Time.now(), msg.caller, "Ownership transferred to " # Principal.toText(next));
  };
};
