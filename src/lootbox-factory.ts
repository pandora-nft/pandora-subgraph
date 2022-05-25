import { BigInt, json } from "@graphprotocol/graph-ts"
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


import { Winner, SingleLootbox, Ticket, DepositedNFT } from "../generated/schema"

export function handleLootboxDeployed(event: LootboxDeployed): void {
    let lootbox = SingleLootbox.load(event.params.lootboxId.toString())
    let lootboxContract = Lootbox.bind(event.params.lootboxAddress)
    if (!lootbox) {
        lootbox = new SingleLootbox(event.params.lootboxId.toString())
    }
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
    lootbox.nft = []
    lootbox.tickets = []
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
        const depositedNFT = DepositedNFT.load(nft.value0.toHexString().concat(nft.value1.toString()))
        if (depositedNFT) {
            winner.nft = depositedNFT.id
            ticket.wonNFT = depositedNFT.id
        }
        winner.isClaimed = false
        ticket.isWinner = true

        winner.save()
        ticket.save()

    }

}

export function handleRefunded(event: Refunded): void {
    for (let i = 0; i < event.params.tokenIds.length; i++) {
        let ticket = Ticket.load(event.params.tokenIds[i].toString())
        ticket!.isRefunded = true
        ticket!.save()
    }
}

export function handleClaimed(event: Claimed): void { 
    let ticket = Ticket.load(event.params.tokenId.toString())
    ticket!.isClaimed = true
    ticket!.save()
}

export function handleNFTDeposited(event: NFTDeposited): void { 
    let factory = LootboxFactory.bind(event.address)
    let lootbox = Lootbox.bind(factory.lootboxAddress(event.params.lootboxId))
    for (let i = 0; i < event.params.nfts.length; i++) {
        let nft = DepositedNFT.load(event.params.nfts[i]._address.toHexString() + "_" + event.params.nfts[i]._tokenId.toString())
        let box = SingleLootbox.load(event.params.lootboxId.toString())
        if (!nft) {
            nft = new DepositedNFT(event.params.nfts[i]._address.toString().concat(event.params.nfts[i]._tokenId.toString()))
        }
        if(!box) {
            box = new SingleLootbox(event.params.lootboxId.toString())
        }
        
        // const erc721 = ERC721.bind(event.params.nfts[i]._address)
        // const tokenURI = erc721.tokenURI(event.params.nfts[i]._tokenId)
        // const base64 = tokenURI.substr(tokenURI.indexOf(",") + 1)
        // const nftMetadata = json.fromString(
        //     Buffer.from(base64, 'base64').toString('binary');
        // )
        // nft.collectionName = erc721.sname()
        // nft.collectionSymbol = erc721.symbol()
        nft.address = event.params.nfts[i]._address
        nft.tokenId = event.params.nfts[i]._tokenId
        nft.lootbox = box.id
        nft.save()

        box.numNFT = box.numNFT.plus(BigInt.fromI32(1))
        let _nft = box.nft
        _nft!.push(nft.id)
        box.nft = _nft
        box.save()
    }
    
}