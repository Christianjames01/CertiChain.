import Map "mo:core/Map";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Array "mo:core/Array";

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

  var owner : Principal = install.caller;
  let entries = Map.empty<Text, Entry>();
  var count : Nat = 0;

  func requireOwner(caller : Principal) {
    if (caller != owner) Runtime.trap("Only the CertiChain registrar can write to this registry.");
  };

  func validFingerprint(h : Text) : Bool {
    h.size() == 66 and Text.startsWith(h, #text "0x");
  };

  public shared (msg) func recordSealed(hashes : [Text], encryptedCopies : [Blob]) : async RecordResult {
    requireOwner(msg.caller);
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
          recorded += 1;
        };
      };
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

  public query func getOwner() : async Principal {
    owner;
  };

  public query func stats() : async { count : Nat; owner : Principal } {
    { count; owner };
  };

  public shared (msg) func transferOwnership(next : Principal) : async () {
    requireOwner(msg.caller);
    if (Principal.isAnonymous(next)) Runtime.trap("The new owner cannot be anonymous.");
    owner := next;
  };
};
