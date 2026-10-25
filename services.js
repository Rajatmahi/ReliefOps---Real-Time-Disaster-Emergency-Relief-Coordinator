"use strict";

const store = require("./store");
const { badRequest, notFound, conflict } = require("./errors");
const { SUPPORTED_CURRENCIES, centsToFloat, convert } = require("./money");
const { splitLargestRemainder } = require("./splitting");
const { computeAttritionPenalty } = require("./attrition");
const { netPairs } = require("./pairwise");
const { minTransfers } = require("./settlement");

// -- Room bookings -----------------------------------------------------------

function bookingToDict(booking) {
    return {
        id: booking.id,
        room_block_id: booking.room_block_id,
        title: booking.title,
        paid_by: booking.paid_by,
        check_in_date: booking.check_in_date,
        check_out_date: booking.check_out_date,
        nightly_rate: booking.nightly_rate,
        nights: booking.nights,
        currency: booking.currency,
        split_strategy: booking.split_strategy,
        participants: booking.participants,
        shares: booking.shares,
        amount: booking.amount,
        created_at: booking.created_at
    };
}

function createBooking(block, payload) {
    if (block.status !== "open") throw conflict("Room block is not open.");
    if (!payload.title || payload.title.trim() === "") throw badRequest("Title is blank.");
    if (!SUPPORTED_CURRENCIES.includes(payload.currency)) throw badRequest("Currency is unsupported.");
    if (!block.parties.includes(payload.paid_by)) throw badRequest("Payer is not a party of the room block.");

    const checkIn = new Date(payload.check_in_date);
    const checkOut = new Date(payload.check_out_date);
    if (checkOut <= checkIn) throw badRequest("check_out_date is not strictly after check_in_date.");

    const nights = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    if (payload.nightly_rate <= 0) throw badRequest("nightly_rate must be greater than 0.");

    const nightlyRateCents = Math.round(payload.nightly_rate * 100);
    const totalAmountCents = nightlyRateCents * nights;

    let participants = payload.split.participants;
    if (!participants || participants.length === 0) {
        participants = [...block.parties];
    }

    const uniqueParticipants = new Set();
    for (const p of participants) {
        if (!block.parties.includes(p)) throw badRequest(`Participant ${p} is not a party.`);
        if (uniqueParticipants.has(p)) throw badRequest("Participants cannot be duplicated.");
        uniqueParticipants.add(p);
    }

    const strategy = payload.split.strategy;
    let finalSharesCents = [];

    if (strategy === "EQUAL") {
        const weights = participants.map(() => 1);
        finalSharesCents = splitLargestRemainder(totalAmountCents, weights);
    } else if (strategy === "WEIGHTED") {
        const payloadShares = payload.split.shares;
        const weights = participants.map(p => {
            const w = payloadShares[p];
            if (w === undefined || w <= 0) throw badRequest("Weights must be greater than 0.");
            return Math.round(w * 100); 
        });
        finalSharesCents = splitLargestRemainder(totalAmountCents, weights);
    } else if (strategy === "FIXED") {
        const payloadShares = payload.split.shares;
        let sumFixedCents = 0;
        for (const p of participants) {
            const amt = payloadShares[p];
            if (amt === undefined || amt <= 0) throw badRequest("Fixed amounts must be > 0.");
            const cents = Math.round(amt * 100);
            finalSharesCents.push(cents);
            sumFixedCents += cents;
        }
        if (sumFixedCents !== totalAmountCents) {
            throw badRequest("FIXED shares do not sum exactly to the total amount.");
        }
    } else {
        throw badRequest("Unsupported split strategy.");
    }

    const calculatedSharesMap = {};
    for (let i = 0; i < participants.length; i++) {
        calculatedSharesMap[participants[i]] = finalSharesCents[i] / 100;
    }

    const booking = {
        id: store.nextId("booking"),
        room_block_id: block.id,
        title: payload.title,
        paid_by: payload.paid_by,
        check_in_date: payload.check_in_date,
        check_out_date: payload.check_out_date,
        nightly_rate: payload.nightly_rate,
        nights: nights,
        currency: payload.currency,
        split_strategy: strategy,
        participants: participants,
        shares: calculatedSharesMap,
        amount: totalAmountCents / 100,
        created_at: store.nowIso(),
        _original_rates: store.ratesSnapshot() 
    };

    block.bookings.push(booking);
    return bookingToDict(booking);
}

function dropParticipant(block, booking, party) {
    if (block.status !== "open") throw conflict("Room block is not open.");
    if (party === booking.paid_by) throw badRequest("Cannot drop the payer.");

    let participants = [...booking.participants];
    if (!participants.includes(party)) throw notFound("Party is not a participant.");
    if (participants.length === 1) throw badRequest("Cannot drop the last participant.");

    participants = participants.filter(p => p !== party);
    booking.participants = participants;

    const totalCents = Math.round(booking.amount * 100);
    let newSharesCents = [];

    if (booking.split_strategy === "EQUAL") {
        const weights = participants.map(() => 1);
        newSharesCents = splitLargestRemainder(totalCents, weights);
    } else {
        const origShares = booking.shares;
        const weights = participants.map(p => Math.round(origShares[p] * 100));
        newSharesCents = splitLargestRemainder(totalCents, weights);
    }

    const updatedSharesMap = {};
    for (let i = 0; i < participants.length; i++) {
        updatedSharesMap[participants[i]] = newSharesCents[i] / 100;
    }
    booking.shares = updatedSharesMap;

    return bookingToDict(booking);
}

// -- Balances ----------------------------------------------------------------

function resolveBase(block, base) {
    if (!base) {
        return block.status === "open" ? "USD" : block.base_currency;
    }
    if (block.status !== "open" && base !== block.base_currency) {
        throw badRequest("Block is closed, base must match base_currency.");
    }
    if (!SUPPORTED_CURRENCIES.includes(base)) {
        throw badRequest("Base currency is unsupported.");
    }
    return base;
}

function bookingDebts(booking, base) {
    const debts = [];
    const rates = booking._original_rates || store.ratesSnapshot();
    
    if (!rates[base] || !rates[booking.currency]) throw badRequest("Missing exchange rate.");

    const shares = booking.shares;
    for (const participant of booking.participants) {
        if (participant === booking.paid_by) continue;
        
        const shareCents = Math.round(shares[participant] * 100);
        // Uses the provided round_half_up convert helper from money.js
        const baseCents = convert(shareCents, booking.currency, base, rates);
            
        if (baseCents > 0) {
            debts.push([participant, booking.paid_by, baseCents]);
        }
    }
    return debts;
}

function netBalances(block, base) {
    const balances = {};
    for (const party of block.parties) balances[party] = 0;

    for (const booking of block.bookings) {
        for (const [from, to, cents] of bookingDebts(booking, base)) {
            balances[from] -= cents;
            balances[to] += cents;
        }
    }

    for (const t of block.transfers || []) {
        balances[t.from] += t.amountCents;
        balances[t.to] -= t.amountCents;
    }

    return balances;
}

function balancesReport(block, base) {
    const resolvedBase = resolveBase(block, base);
    const balances = netBalances(block, resolvedBase);
    
    let allDebts = [];
    for (const b of block.bookings) {
        allDebts = allDebts.concat(bookingDebts(b, resolvedBase));
    }
    const resolvedPairs = netPairs(allDebts);

    const partyBalances = block.parties.map(party => {
        const owes = [];
        const owed_by = [];
        
        for (const [from, to, cents] of resolvedPairs) {
            if (from === party) owes.push({ to: to, amount: cents / 100 });
            if (to === party) owed_by.push({ from: from, amount: cents / 100 });
        }

        return {
            party: party,
            net_balance: balances[party] / 100,
            owes: owes,
            owed_by: owed_by
        };
    });

    return {
        room_block_id: block.id,
        base_currency: resolvedBase,
        balances: partyBalances
    };
}

// -- Settlement lifecycle ----------------------------------------------------

function settleReport(block, base) {
    const resolvedBase = resolveBase(block, base);
    let plan = [];
    
    if (block.status === "open") {
        const balances = netBalances(block, resolvedBase);
        plan = minTransfers(balances);
    } else {
        plan = block.planned_transfers || [];
    }

    let totalTransferred = 0;
    const transfersJson = plan.map(([from, to, cents]) => {
        totalTransferred += cents;
        return { from, to, amount: cents / 100 };
    });

    return {
        room_block_id: block.id,
        status: block.status,
        base_currency: resolvedBase,
        attrition: block.attrition || null,
        transfers: transfersJson,
        transfer_count: plan.length,
        total_transferred: totalTransferred / 100
    };
}

function closeBlock(block, base) {
    if (block.status !== "open") throw conflict("Block not open.");
    if (!base) throw badRequest("Base required.");
    if (!SUPPORTED_CURRENCIES.includes(base)) throw badRequest("Base currency is unsupported.");

    let filledNights = 0;
    for (const b of block.bookings) filledNights += b.nights;
    
    const penaltyCents = computeAttritionPenalty(
        block.committed_room_nights, block.attrition_threshold_pct * 100, 
        filledNights, Math.round(block.penalty_rate * 100)
    );

    const shortfall = Math.max(0, block.committed_room_nights - filledNights);
    block.attrition = {
        shortfall_room_nights: shortfall,
        penalty_amount: penaltyCents / 100
    };

    if (penaltyCents > 0) {
        const penaltyBooking = {
            id: store.nextId("booking"),
            room_block_id: block.id,
            title: "Attrition Penalty",
            paid_by: "Hotel",
            check_in_date: store.nowIso().substring(0, 10), 
            check_out_date: store.nowIso().substring(0, 10), 
            nightly_rate: block.penalty_rate,
            nights: shortfall,
            currency: block.penalty_currency,
            split_strategy: "FIXED",
            participants: [block.organizer],
            shares: { [block.organizer]: penaltyCents / 100 },
            amount: penaltyCents / 100,
            created_at: store.nowIso(),
            _original_rates: store.ratesSnapshot()
        };
        block.bookings.push(penaltyBooking);
    }

    block.base_currency = base;
    const balances = netBalances(block, base);
    block.planned_transfers = minTransfers(balances);
    
    block.status = block.planned_transfers.length === 0 ? "settled" : "closed";
    return settleReport(block, base);
}

function recordTransfer(block, payload) {
    if (block.status === "open") throw conflict("Block is open.");
    
    const cents = payload.amountCents; // From parseTransferCreate
    let match = null;
    
    for (const pt of (block.planned_transfers || [])) {
        if (pt[0] === payload.from && pt[1] === payload.to && pt[2] === cents) {
            let paidSoFar = 0;
            for (const t of (block.transfers || [])) {
                if (t.from === pt[0] && t.to === pt[1]) paidSoFar += t.amountCents;
            }
            if (paidSoFar < pt[2]) {
                match = pt;
                break;
            }
        }
    }
    
    if (!match) throw conflict("No matching unpaid planned transfer found.");

    const newTrans = {
        id: store.nextId("transfer"),
        room_block_id: block.id,
        from: payload.from,
        to: payload.to,
        amountCents: cents,
        created_at: store.nowIso()
    };
    
    if (!block.transfers) block.transfers = [];
    block.transfers.push(newTrans);

    let totalPlanned = 0, totalPaid = 0;
    for (const pt of block.planned_transfers) totalPlanned += pt[2];
    for (const t of block.transfers) totalPaid += t.amountCents;
    
    if (totalPaid >= totalPlanned) {
        block.status = "settled";
    }

    return {
        id: newTrans.id,
        room_block_id: newTrans.room_block_id,
        from: newTrans.from,
        to: newTrans.to,
        amount: newTrans.amountCents / 100,
        created_at: newTrans.created_at
    };
}

module.exports = {
    bookingToDict,
    createBooking,
    dropParticipant,
    resolveBase,
    bookingDebts,
    netBalances,
    balancesReport,
    settleReport,
    closeBlock,
    recordTransfer
};