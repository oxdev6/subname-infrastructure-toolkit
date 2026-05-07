// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SubnameRegistrar is AccessControl, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    bytes32 private constant MINT_AUTH_TYPEHASH = keccak256(
        "MintAuthorization(address recipient,string label,uint64 expiresAt,uint256 nonce,uint256 deadline)"
    );

    string public rootDomain;

    struct SubnameRecord {
        address owner;
        uint64 expiresAt;
        bool revoked;
    }

    mapping(bytes32 => SubnameRecord) public records;
    mapping(address => uint256) public nonces;

    event SubnameMinted(string indexed fqdn, string label, address indexed recipient, uint64 expiresAt);
    event SubnameRevoked(string indexed fqdn, string label, address indexed revokedBy);
    event SubnameRenewed(string indexed fqdn, string label, uint64 newExpiresAt, address indexed renewedBy);

    error EmptyLabel();
    error InvalidExpiry();
    error AlreadyActive();
    error NotFound();
    error InvalidAuthorization();

    constructor(string memory _rootDomain, address admin) EIP712("ENSSubnameRegistrar", "1") {
        rootDomain = _rootDomain;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(SIGNER_ROLE, admin);
    }

    function mintSubname(string calldata label, address recipient, uint64 expiresAt) external onlyRole(MINTER_ROLE) {
        _mint(label, recipient, expiresAt);
    }

    function mintWithSignature(
        string calldata label,
        address recipient,
        uint64 expiresAt,
        uint256 deadline,
        bytes calldata signature
    ) external {
        if (block.timestamp > deadline) revert InvalidAuthorization();

        uint256 nonce = nonces[recipient];
        bytes32 structHash = keccak256(
            abi.encode(
                MINT_AUTH_TYPEHASH,
                recipient,
                keccak256(bytes(label)),
                expiresAt,
                nonce,
                deadline
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        if (!hasRole(SIGNER_ROLE, signer)) revert InvalidAuthorization();

        nonces[recipient] = nonce + 1;
        _mint(label, recipient, expiresAt);
    }

    function revokeSubname(string calldata label) external onlyRole(MINTER_ROLE) {
        bytes32 key = _key(label);
        SubnameRecord storage rec = records[key];

        if (rec.owner == address(0)) revert NotFound();
        if (rec.revoked) revert NotFound();

        rec.revoked = true;
        emit SubnameRevoked(_fqdn(label), label, msg.sender);
    }

    function renewSubname(string calldata label, uint64 newExpiresAt) external onlyRole(MINTER_ROLE) {
        if (newExpiresAt <= block.timestamp) revert InvalidExpiry();

        bytes32 key = _key(label);
        SubnameRecord storage rec = records[key];
        if (rec.owner == address(0) || rec.revoked) revert NotFound();

        rec.expiresAt = newExpiresAt;
        emit SubnameRenewed(_fqdn(label), label, newExpiresAt, msg.sender);
    }

    function isActive(string calldata label) external view returns (bool) {
        SubnameRecord memory rec = records[_key(label)];
        return rec.owner != address(0) && !rec.revoked && rec.expiresAt > block.timestamp;
    }

    function getSubnameRecord(
        string calldata label
    ) external view returns (address owner, uint64 expiresAt, bool revoked, bool active) {
        SubnameRecord memory rec = records[_key(label)];
        bool isActiveRecord = rec.owner != address(0) && !rec.revoked && rec.expiresAt > block.timestamp;
        return (rec.owner, rec.expiresAt, rec.revoked, isActiveRecord);
    }

    function _mint(string calldata label, address recipient, uint64 expiresAt) internal {
        if (bytes(label).length == 0) revert EmptyLabel();
        if (expiresAt <= block.timestamp) revert InvalidExpiry();

        bytes32 key = _key(label);
        SubnameRecord storage rec = records[key];

        if (rec.owner != address(0) && !rec.revoked && rec.expiresAt > block.timestamp) {
            revert AlreadyActive();
        }

        rec.owner = recipient;
        rec.expiresAt = expiresAt;
        rec.revoked = false;

        emit SubnameMinted(_fqdn(label), label, recipient, expiresAt);
    }

    function _key(string calldata label) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(label, ".", rootDomain));
    }

    function _fqdn(string calldata label) internal view returns (string memory) {
        return string(abi.encodePacked(label, ".", rootDomain));
    }
}
