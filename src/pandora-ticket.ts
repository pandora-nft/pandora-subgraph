import { Address, BigInt } from "@graphprotocol/graph-ts"
import {
  TicketMinted,
  Transfer,
} from "../generated/PandoraTicket/PandoraTicket"
import { SingleLootbox, Ticket, Winner } from "../generated/schema"
import { resyncTicketTokenURI } from "./utils"

export function handleMint(event: TicketMinted): void {
  let ticket = Ticket.load(event.params.tokenId.toString())
  let lootbox = SingleLootbox.load(event.params.lootboxId.toString())
  if (!ticket) {
    ticket = new Ticket(event.params.tokenId.toString())
  }
  if (!lootbox) {
    lootbox = new SingleLootbox(event.params.lootboxId.toString())
  }
  ticket.owner = event.params.to
  ticket.ticketId = event.params.tokenId
  ticket.lootbox = lootbox.id
  ticket.isWinner = false
  ticket.isClaimed = false
  ticket.isRefunded = false
  resyncTicketTokenURI(ticket, event.address)
  ticket.save()

  let _players = lootbox.players
  if (_players && !_players.includes(event.params.to)) {
    _players.push(event.params.to)
  }

  lootbox.players = _players
  lootbox.ticketSold = lootbox.ticketSold.plus(BigInt.fromI32(1))
  lootbox.save()
}
