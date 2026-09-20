// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Friendenza} from "../src/Friendenza.sol";
import {MockGenesis} from "../src/MockGenesis.sol";

contract ReenteringClaimer is IERC721Receiver {
    Friendenza private immutable target;
    uint256 private sourceTokenId;
    string private tokenUri;
    bytes32 private metadataDigest;
    uint256 private deadline;
    bytes private signature;

    constructor(Friendenza target_) {
        target = target_;
    }

    function attack(
        uint256 sourceTokenId_,
        string calldata tokenUri_,
        bytes32 metadataDigest_,
        uint256 deadline_,
        bytes calldata signature_
    ) external {
        sourceTokenId = sourceTokenId_;
        tokenUri = tokenUri_;
        metadataDigest = metadataDigest_;
        deadline = deadline_;
        signature = signature_;
        target.claim(sourceTokenId_, tokenUri_, metadataDigest_, deadline_, signature_);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external returns (bytes4) {
        target.claim(sourceTokenId, tokenUri, metadataDigest, deadline, signature);
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract FriendenzaTest is Test {
    uint256 private constant SIGNER_KEY = 0xA11CE;
    uint256 private constant TOKEN_ID = 42;
    bytes32 private constant METADATA_DIGEST = keccak256("metadata");
    string private constant TOKEN_URI = "ipfs://metadata";

    address private signer;
    address private alice;
    address private bob;
    MockGenesis private genesis;
    Friendenza private friendenza;

    function setUp() public {
        signer = vm.addr(SIGNER_KEY);
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        genesis = new MockGenesis(address(this));
        friendenza = new Friendenza(address(genesis), signer, address(this));
        genesis.mint(alice, TOKEN_ID);
    }

    function signClaim(
        address recipient,
        uint256 tokenId,
        bytes32 metadataDigest,
        string memory tokenUri,
        uint256 deadline
    ) private view returns (bytes memory) {
        bytes32 digest = friendenza.hashClaim(
            recipient,
            tokenId,
            metadataDigest,
            keccak256(bytes(tokenUri)),
            deadline
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, digest);
        return abi.encodePacked(r, s, v);
    }

    function testClaimMintsMatchingTokenAndStoresProvenance() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = signClaim(
            alice,
            TOKEN_ID,
            METADATA_DIGEST,
            TOKEN_URI,
            deadline
        );

        vm.prank(alice);
        friendenza.claim(TOKEN_ID, TOKEN_URI, METADATA_DIGEST, deadline, signature);

        assertEq(friendenza.ownerOf(TOKEN_ID), alice);
        assertEq(friendenza.tokenURI(TOKEN_ID), TOKEN_URI);
        assertEq(friendenza.metadataDigestOf(TOKEN_ID), METADATA_DIGEST);
        assertTrue(friendenza.claimed(TOKEN_ID));
    }

    function testDuplicateClaimReverts() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = signClaim(
            alice,
            TOKEN_ID,
            METADATA_DIGEST,
            TOKEN_URI,
            deadline
        );
        vm.prank(alice);
        friendenza.claim(TOKEN_ID, TOKEN_URI, METADATA_DIGEST, deadline, signature);

        vm.expectRevert(Friendenza.AlreadyClaimed.selector);
        vm.prank(alice);
        friendenza.claim(TOKEN_ID, TOKEN_URI, METADATA_DIGEST, deadline, signature);
    }

    function testNonOwnerAndTransferredOwnerCannotUseOldAuthorization() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory aliceSignature = signClaim(
            alice,
            TOKEN_ID,
            METADATA_DIGEST,
            TOKEN_URI,
            deadline
        );

        vm.expectRevert(Friendenza.NotGenesisOwner.selector);
        vm.prank(bob);
        friendenza.claim(TOKEN_ID, TOKEN_URI, METADATA_DIGEST, deadline, aliceSignature);

        vm.prank(alice);
        genesis.transferFrom(alice, bob, TOKEN_ID);
        vm.expectRevert(Friendenza.NotGenesisOwner.selector);
        vm.prank(alice);
        friendenza.claim(TOKEN_ID, TOKEN_URI, METADATA_DIGEST, deadline, aliceSignature);
    }

    function testWrongSignerExpiredAndFrontRunRevert() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory aliceSignature = signClaim(
            alice,
            TOKEN_ID,
            METADATA_DIGEST,
            TOKEN_URI,
            deadline
        );

        vm.expectRevert(Friendenza.NotGenesisOwner.selector);
        vm.prank(bob);
        friendenza.claim(TOKEN_ID, TOKEN_URI, METADATA_DIGEST, deadline, aliceSignature);

        vm.warp(deadline + 1);
        vm.expectRevert(Friendenza.AuthorizationExpired.selector);
        vm.prank(alice);
        friendenza.claim(TOKEN_ID, TOKEN_URI, METADATA_DIGEST, deadline, aliceSignature);

        uint256 freshDeadline = block.timestamp + 1 hours;
        bytes32 digest = friendenza.hashClaim(
            alice,
            TOKEN_ID,
            METADATA_DIGEST,
            keccak256(bytes(TOKEN_URI)),
            freshDeadline
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xB0B, digest);
        bytes memory wrongSignature = abi.encodePacked(r, s, v);
        vm.expectRevert(Friendenza.InvalidAuthorization.selector);
        vm.prank(alice);
        friendenza.claim(
            TOKEN_ID,
            TOKEN_URI,
            METADATA_DIGEST,
            freshDeadline,
            wrongSignature
        );
    }

    function testReentrantReceiverCannotClaim() public {
        ReenteringClaimer attacker = new ReenteringClaimer(friendenza);
        genesis.mint(address(attacker), 77);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = signClaim(
            address(attacker),
            77,
            METADATA_DIGEST,
            TOKEN_URI,
            deadline
        );

        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        attacker.attack(77, TOKEN_URI, METADATA_DIGEST, deadline, signature);
        assertFalse(friendenza.claimed(77));
    }

    function testOwnerCanRotateAuthorizationSigner() public {
        address nextSigner = makeAddr("nextSigner");
        friendenza.setAuthorizationSigner(nextSigner);
        assertEq(friendenza.authorizationSigner(), nextSigner);

        vm.expectRevert();
        vm.prank(alice);
        friendenza.setAuthorizationSigner(alice);
    }
}
