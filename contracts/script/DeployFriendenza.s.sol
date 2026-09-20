// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Friendenza} from "../src/Friendenza.sol";

contract DeployFriendenza is Script {
    function run() external returns (Friendenza deployed) {
        address genesis = vm.envAddress("GENESIS_CONTRACT");
        address authorizationSigner = vm.envAddress("AUTHORIZATION_SIGNER");
        address contractOwner = vm.envAddress("CONTRACT_OWNER");

        vm.startBroadcast();
        deployed = new Friendenza(genesis, authorizationSigner, contractOwner);
        vm.stopBroadcast();

        console2.log("Friendenza deployed at", address(deployed));
        console2.log("Genesis contract", genesis);
        console2.log("Authorization signer", authorizationSigner);
        console2.log("Contract owner", contractOwner);
    }
}
