// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Friendenza} from "../src/Friendenza.sol";

contract DeployFriendenza is Script {
    uint256 internal constant ROBINHOOD_MAINNET_CHAIN_ID = 4663;

    function run() external returns (Friendenza deployed) {
        require(
            block.chainid == ROBINHOOD_MAINNET_CHAIN_ID,
            "DeployFriendenza: wrong chain"
        );
        address genesis = vm.envAddress("GENESIS_CONTRACT");
        address authorizationSigner = vm.envAddress("AUTHORIZATION_SIGNER");
        address contractOwner = vm.envAddress("CONTRACT_OWNER");
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        require(
            contractOwner == deployer,
            "DeployFriendenza: owner must equal deployer"
        );

        vm.startBroadcast(deployerPrivateKey);
        deployed = new Friendenza(genesis, authorizationSigner, contractOwner);
        vm.stopBroadcast();

        console2.log("Friendenza deployed at", address(deployed));
        console2.log("Deployer", deployer);
        console2.log("Genesis contract", genesis);
        console2.log("Authorization signer", authorizationSigner);
        console2.log("Contract owner", contractOwner);
    }
}
