import { BigInt, json, ipfs, JSONValueKind, JSONValue, Bytes } from "@graphprotocol/graph-ts"
import {
    LootboxFactory,
    LootboxDeployed,
    Drawn,
    Refunded,
    Claimed,
    NFTDeposited
} from "../generated/LootboxFactory/LootboxFactory"
import { Lootbox } from "../generated/LootboxFactory/Lootbox"
import { PandoraTicket } from "../generated/PandoraTicket/PandoraTicket"
import { ERC721 } from "../generated/PandoraTicket/ERC721"
import { Winner, SingleLootbox, Ticket, DepositedNFT } from "../generated/schema"
import { decode } from "as-base64"
import { getIpfsHash, resyncTicketTokenURI } from "./utils"

export function handleLootboxDeployed(event: LootboxDeployed): void {
    let lootbox = SingleLootbox.load(event.params.lootboxId.toString())
    let lootboxContract = Lootbox.bind(event.params.lootboxAddress)
    if (!lootbox) {
        lootbox = new SingleLootbox(event.params.lootboxId.toString())
    }
    lootbox.address = event.params.lootboxAddress
    lootbox.drawTimestamp = lootboxContract.drawTimestamp()
    lootbox.ticketPrice = lootboxContract.ticketPrice()
    lootbox.minimumTicketRequired = lootboxContract.minimumTicketRequired()
    lootbox.maxTicketPerWallet = lootboxContract.maxTicketPerWallet()
    lootbox.owner = event.params.owner
    lootbox.ticketSold = BigInt.fromI32(0)
    lootbox.numNFT = BigInt.fromI32(0)
    lootbox.isDrawn = false
    lootbox.isRefundable = false
    lootbox.name = lootboxContract.name()
    lootbox.boxId = event.params.lootboxId
    lootbox.players = []
    lootbox.save()
}

export function handleDrawn(event: Drawn): void {
    let lootbox = SingleLootbox.load(event.params.lootboxId.toString())
    let lootboxContract = Lootbox.bind(event.params.lootboxAddress)

    let lootboxFactoryContract = LootboxFactory.bind(event.address)

    let ticketAddress = lootboxFactoryContract.ticketAddress()
    let ticketContract = PandoraTicket.bind(ticketAddress)

    if (!lootbox) {
        lootbox = new SingleLootbox(event.params.lootboxId.toString())
    }
    lootbox.isDrawn = true
    lootbox.isRefundable = lootboxContract.isRefundable()
    lootbox.save()

    for (let i = 0; i < event.params.winners.length; i++) {
        let winner = Winner.load(event.params.winners[i].toString())
        let ticket = Ticket.load(event.params.winners[i].toString())
        if (!winner) {
            winner = new Winner(event.params.winners[i].toString())
        }
        if (!ticket) {
            ticket = new Ticket(event.params.winners[i].toString())
        }
        winner.ticket = ticket.id
        winner.lootbox = ticket.lootbox
        winner.winnerAddress = ticketContract.ownerOf(event.params.winners[i])
        const nft = lootboxContract.NFTs(lootboxContract.wonTicket(event.params.winners[i]))
        const depositedNFT = DepositedNFT.load(nft.value0.toHexString() + '_' + (nft.value1.toString()))
        if (depositedNFT) {
            winner.nft = depositedNFT.id
            ticket.wonNFT = depositedNFT.id
        }
        winner.isClaimed = false
        ticket.isWinner = true

        resyncTicketTokenURI(ticket, ticketAddress)
        winner.save()
        ticket.save()

    }

}

export function handleRefunded(event: Refunded): void {
    let lootboxFactoryContract = LootboxFactory.bind(event.address)
    let ticketAddress = lootboxFactoryContract.ticketAddress()
    for (let i = 0; i < event.params.tokenIds.length; i++) {
        let ticket = Ticket.load(event.params.tokenIds[i].toString())
        ticket!.isRefunded = true
        resyncTicketTokenURI(ticket!, ticketAddress)
        ticket!.save()
    }
}

export function handleClaimed(event: Claimed): void {
    let lootboxFactoryContract = LootboxFactory.bind(event.address)

    let ticketAddress = lootboxFactoryContract.ticketAddress()
    let ticket = Ticket.load(event.params.tokenId.toString())
    ticket!.isClaimed = true
    resyncTicketTokenURI(ticket!, ticketAddress)
    ticket!.save()
}

export function handleNFTDeposited(event: NFTDeposited): void {
    let factory = LootboxFactory.bind(event.address)
    let lootbox = Lootbox.bind(factory.lootboxAddress(event.params.lootboxId))
    for (let i = 0; i < event.params.nfts.length; i++) {
        let nft = DepositedNFT.load(event.params.nfts[i]._address.toHexString() + '_' + (event.params.nfts[i]._tokenId.toString()))
        let box = SingleLootbox.load(event.params.lootboxId.toString())
        if (!nft) {
            nft = new DepositedNFT(event.params.nfts[i]._address.toHexString() + '_' + (event.params.nfts[i]._tokenId.toString()))
        }
        if (!box) {
            box = new SingleLootbox(event.params.lootboxId.toString())
        }

        const erc721 = ERC721.bind(event.params.nfts[i]._address)

        const tokenURI = erc721.tokenURI(event.params.nfts[i]._tokenId)
        nft.tokenURI = tokenURI
        const hash = getIpfsHash(tokenURI)
        if (hash) {
            const metadata = ipfs.cat(hash)
            if (metadata) {
                const data = json.fromBytes(metadata).toObject()
                if (data.isSet("name")) {
                    nft.name = data.get("name")!.toString()
                }
                if (data.isSet("description")) {
                    nft.description = data.get("description")!.toString()
                }
                if (data.isSet("image")) {
                    nft.image = data.get("image")!.toString()
                }
            }
        } else {
            const base64 = tokenURI.substr(tokenURI.indexOf(",") + 1)
            if (base64.startsWith("ey")) {

                const nftMetadata = json.fromBytes(Bytes.fromUint8Array(decode(base64))).toObject()
                if (nftMetadata.isSet("name")) {
                    nft.name = nftMetadata.get("name")!.toString()
                }
                if (nftMetadata.isSet("description")) {
                    nft.description = nftMetadata.get("description")!.toString()
                }
                if (nftMetadata.isSet("image")) {
                    nft.image = nftMetadata.get("image")!.toString()
                }
            }
        }
        nft.collectionName = erc721.name()
        nft.collectionSymbol = erc721.symbol()
        nft.address = event.params.nfts[i]._address
        nft.tokenId = event.params.nfts[i]._tokenId
        nft.lootbox = box.id
        nft.save()

        box.numNFT = box.numNFT.plus(BigInt.fromI32(1))
        box.save()
    }

}