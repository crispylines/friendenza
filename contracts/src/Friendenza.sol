// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IGenesisOwner {
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract Friendenza is ERC721URIStorage, EIP712, Ownable, ReentrancyGuard {
    bytes32 public constant CLAIM_TYPEHASH = keccak256(
        "Claim(address recipient,uint256 sourceTokenId,bytes32 metadataDigest,bytes32 tokenUriHash,uint256 deadline)"
    );

    error AlreadyClaimed();
    error AuthorizationExpired();
    error InvalidAuthorization();
    error InvalidConfiguration();
    error NotGenesisOwner();

    event FriendenzaClaimed(
        address indexed recipient,
        uint256 indexed sourceTokenId,
        bytes32 indexed metadataDigest,
        string tokenUri
    );
    event AuthorizationSignerUpdated(address indexed previousSigner, address indexed newSigner);

    IGenesisOwner public immutable genesis;
    address public authorizationSigner;
    mapping(uint256 sourceTokenId => bool) public claimed;
    mapping(uint256 tokenId => bytes32) public metadataDigestOf;

    constructor(
        address genesisAddress,
        address initialAuthorizationSigner,
        address initialOwner
    )
        ERC721("Friendenza", "FRNDZA")
        EIP712("Friendenza", "1")
        Ownable(initialOwner)
    {
        if (
            genesisAddress == address(0) ||
            initialAuthorizationSigner == address(0) ||
            initialOwner == address(0)
        ) revert InvalidConfiguration();
        genesis = IGenesisOwner(genesisAddress);
        authorizationSigner = initialAuthorizationSigner;
    }

    function hashClaim(
        address recipient,
        uint256 sourceTokenId,
        bytes32 metadataDigest,
        bytes32 tokenUriHash,
        uint256 deadline
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                CLAIM_TYPEHASH,
                recipient,
                sourceTokenId,
                metadataDigest,
                tokenUriHash,
                deadline
            )
        );
        return _hashTypedDataV4(structHash);
    }

    function claim(
        uint256 sourceTokenId,
        string calldata tokenUri,
        bytes32 metadataDigest,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        if (block.timestamp > deadline) revert AuthorizationExpired();
        if (claimed[sourceTokenId]) revert AlreadyClaimed();
        if (genesis.ownerOf(sourceTokenId) != msg.sender) revert NotGenesisOwner();

        bytes32 digest = hashClaim(
            msg.sender,
            sourceTokenId,
            metadataDigest,
            keccak256(bytes(tokenUri)),
            deadline
        );
        if (ECDSA.recover(digest, signature) != authorizationSigner) {
            revert InvalidAuthorization();
        }

        claimed[sourceTokenId] = true;
        metadataDigestOf[sourceTokenId] = metadataDigest;
        _safeMint(msg.sender, sourceTokenId);
        _setTokenURI(sourceTokenId, tokenUri);

        emit FriendenzaClaimed(msg.sender, sourceTokenId, metadataDigest, tokenUri);
    }

    function setAuthorizationSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert InvalidConfiguration();
        address previousSigner = authorizationSigner;
        authorizationSigner = newSigner;
        emit AuthorizationSignerUpdated(previousSigner, newSigner);
    }
}
