import { Address, json, Bytes } from "@graphprotocol/graph-ts"
import { decode } from "as-base64"
import { PandoraTicket } from "../generated/PandoraTicket/PandoraTicket"
import { Ticket } from "../generated/schema"
export function getIpfsHash(uri: string | null): string | null {
  if (uri != null) {
    let hash = uri!.replace("ipfs://", "")
    hash = hash.replace("ar://","")

    if (hash != null && hash.startsWith('Qm')) {
      return hash
    }
  }

  return null
}

export function resyncTicketTokenURI(ticket: Ticket, ticketAddress: Address): Ticket | null {
  const ticketContract = PandoraTicket.bind(ticketAddress)
  const tokenURI = ticketContract.tokenURI(ticket.ticketId)
  if (tokenURI != null) {
    const base64 = tokenURI.substr(tokenURI.indexOf(",") + 1)
    const nftMetadata = json.fromBytes(Bytes.fromUint8Array(decode(base64))).toObject()
    if (nftMetadata.isSet("name")) {
      ticket.name = nftMetadata.get("name")!.toString()
    }
    if (nftMetadata.isSet("description")) {
      ticket.description = nftMetadata.get("description")!.toString()
    }
    if (nftMetadata.isSet("image")) {
      ticket.image = nftMetadata.get("image")!.toString()
    }
    return ticket
  }
  return null
}