// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Friendenza} from "../src/Friendenza.sol";
import {MockGenesis} from "../src/MockGenesis.sol";

contract DeployTestnet is Script {
    function run() external returns (MockGenesis genesis, Friendenza friendenza) {
        address authorizationSigner = vm.envAddress("AUTHORIZATION_SIGNER");
        address contractOwner = vm.envAddress("CONTRACT_OWNER");
        address testHolder = vm.envAddress("TEST_HOLDER");
        uint256 testTokenId = vm.envOr("TEST_TOKEN_ID", uint256(42));
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        genesis = new MockGenesis(contractOwner);
        friendenza = new Friendenza(address(genesis), authorizationSigner, contractOwner);
        genesis.mint(testHolder, testTokenId);
        vm.stopBroadcast();

        console2.log("Mock Genesis deployed at", address(genesis));
        console2.log("Friendenza deployed at", address(friendenza));
        console2.log("Test token minted", testTokenId);
        console2.log("Test holder", testHolder);
    }
}
