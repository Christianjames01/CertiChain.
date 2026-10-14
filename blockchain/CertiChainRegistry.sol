// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CertiChainRegistry {
    struct Entry {
        uint64 recordedAt;
        uint64 revokedAt;
    }

    address public owner;
    mapping(bytes32 => Entry) private entries;

    event Recorded(bytes32 indexed hash, uint64 recordedAt);
    event Revoked(bytes32 indexed hash, uint64 revokedAt);
    event Sealed(bytes32 indexed hash, bytes encryptedCopy);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAddress();
    error LengthMismatch();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function record(bytes32[] calldata hashes) external onlyOwner {
        uint64 nowTs = uint64(block.timestamp);
        for (uint256 i = 0; i < hashes.length; i++) {
            Entry storage e = entries[hashes[i]];
            if (e.recordedAt == 0) {
                e.recordedAt = nowTs;
                emit Recorded(hashes[i], nowTs);
            }
        }
    }

    function recordSealed(bytes32[] calldata hashes, bytes[] calldata encryptedCopies) external onlyOwner {
        if (hashes.length != encryptedCopies.length) revert LengthMismatch();
        uint64 nowTs = uint64(block.timestamp);
        for (uint256 i = 0; i < hashes.length; i++) {
            Entry storage e = entries[hashes[i]];
            if (e.recordedAt == 0) {
                e.recordedAt = nowTs;
                emit Recorded(hashes[i], nowTs);
                emit Sealed(hashes[i], encryptedCopies[i]);
            }
        }
    }

    function revoke(bytes32[] calldata hashes) external onlyOwner {
        uint64 nowTs = uint64(block.timestamp);
        for (uint256 i = 0; i < hashes.length; i++) {
            Entry storage e = entries[hashes[i]];
            if (e.recordedAt != 0 && e.revokedAt == 0) {
                e.revokedAt = nowTs;
                emit Revoked(hashes[i], nowTs);
            }
        }
    }

    function lookup(bytes32 hash) external view returns (uint64 recordedAt, uint64 revokedAt) {
        Entry storage e = entries[hash];
        return (e.recordedAt, e.revokedAt);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
