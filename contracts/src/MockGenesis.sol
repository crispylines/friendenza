// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract MockGenesis is ERC721, Ownable {
    constructor(address initialOwner)
        ERC721("Rare Friends Genesis Test", "GENESIS-TEST")
        Ownable(initialOwner)
    {}

    function mint(address recipient, uint256 tokenId) external onlyOwner {
        _mint(recipient, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        ownerOf(tokenId);
        string memory tokenNumber = Strings.toString(tokenId);
        string memory svg = string.concat(
            "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"512\" height=\"512\" ",
            "viewBox=\"0 0 8 8\" shape-rendering=\"crispEdges\">",
            "<rect width=\"8\" height=\"8\" fill=\"#111\"/>",
            "<path fill=\"#eee\" d=\"M2 1h3v1H2zM1 2h1v1H1zM5 2h1v1H5z",
            "M2 3h1v1H2zM4 3h1v1H4zM3 4h1v1H3zM2 6h3v1H2z\"/>",
            "</svg>"
        );
        string memory image = string.concat(
            "data:image/svg+xml;base64,",
            Base64.encode(bytes(svg))
        );
        string memory json = string.concat(
            "{\"name\":\"Test Rare Friend #",
            tokenNumber,
            "\",\"description\":\"Friendenza testnet ownership fixture\",",
            "\"image\":\"",
            image,
            "\",\"attributes\":[",
            "{\"trait_type\":\"Background\",\"value\":\"Test Gray\"},",
            "{\"trait_type\":\"Eyes\",\"value\":\"Pixel\"},",
            "{\"trait_type\":\"Body\",\"value\":\"Test Robot\"}]} "
        );

        return string.concat(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        );
    }
}
