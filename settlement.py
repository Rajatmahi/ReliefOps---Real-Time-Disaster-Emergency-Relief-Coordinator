from typing import Dict, List, Tuple

def min_transfers(balances: Dict[str, int]) -> List[Tuple[str, str, int]]:
    """
    `balances` maps each party to net cents (positive = is owed money); they sum to 0.

    Returns (from, to, cents) transfers that bring every balance to 0 using the minimum
    possible number of transfers. Every amount is positive and from != to.
    Money only flows from parties with a negative balance to parties with a positive balance:
    nobody pays more than they owe or receives more than they are owed.
    Any minimum plan that follows these rules is accepted.
    """
    names = []
    bals = []
    
    for name, net in balances.items():
        if net != 0:
            names.append(name)
            bals.append(net)

    n = len(names)
    if n == 0:
        return []

    # Calculate sum of balances for every possible subset of parties
    sums = [0] * (1 << n)
    for i in range(1 << n):
        current_sum = 0
        for j in range(n):
            if i & (1 << j):
                current_sum += bals[j]
        sums[i] = current_sum

    dp = [0] * (1 << n)
    prev = [-1] * (1 << n)

    # Find the maximum number of zero-sum subsets
    for i in range(1, 1 << n):
        if sums[i] != 0:
            continue
        dp[i] = 1
        prev[i] = i
        
        # Iterate over all valid submasks
        sub = (i - 1) & i
        while sub > 0:
            if sums[sub] == 0:
                if dp[sub] + dp[i ^ sub] > dp[i]:
                    dp[i] = dp[sub] + dp[i ^ sub]
                    prev[i] = sub
            sub = (sub - 1) & i

    # Reconstruct the optimal disjoint subsets
    subsets = []
    q = [(1 << n) - 1]
    
    while q:
        mask = q.pop(0)
        if mask == 0:
            continue
        if prev[mask] == mask:
            subsets.append(mask)
        else:
            q.append(prev[mask])
            q.append(mask ^ prev[mask])

    transfers = []
    current_bals = list(bals)

    # Greedily settle debts within each independent zero-sum subset
    for mask in subsets:
        debtors = []
        creditors = []
        
        for j in range(n):
            if mask & (1 << j):
                if bals[j] < 0:
                    debtors.append(j)
                elif bals[j] > 0:
                    creditors.append(j)

        d = 0
        c = 0
        while d < len(debtors) and c < len(creditors):
            debtor = debtors[d]
            creditor = creditors[c]
            
            amount = min(-current_bals[debtor], current_bals[creditor])
            
            if amount > 0:
                transfers.append((names[debtor], names[creditor], amount))
                current_bals[debtor] += amount
                current_bals[creditor] -= amount

            if current_bals[debtor] == 0:
                d += 1
            if current_bals[creditor] == 0:
                c += 1

    return transfers