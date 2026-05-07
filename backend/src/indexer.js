export function startIndexer({ registrar, rootDomain, indexStore }) {
  const onMint = async (fqdn, label, recipient, expiresAt, event) => {
    indexStore.applyMint({
      label,
      fqdn: fqdn || `${label}.${rootDomain}`,
      owner: recipient,
      expiresAt: Number(expiresAt),
      txHash: event?.log?.transactionHash || event?.transactionHash || null
    });
  };

  const onRevoke = async (fqdn, label, _revokedBy, event) => {
    indexStore.applyRevoke({
      label,
      txHash: event?.log?.transactionHash || event?.transactionHash || null
    });
  };

  registrar.on("SubnameMinted", onMint);
  registrar.on("SubnameRevoked", onRevoke);

  return () => {
    registrar.off("SubnameMinted", onMint);
    registrar.off("SubnameRevoked", onRevoke);
  };
}
