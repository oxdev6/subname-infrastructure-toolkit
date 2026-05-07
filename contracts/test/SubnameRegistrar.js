const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SubnameRegistrar", function () {
  async function deployFixture() {
    const [admin, minter, signer, recipient, other] = await ethers.getSigners();
    const Registrar = await ethers.getContractFactory("SubnameRegistrar");
    const registrar = await Registrar.deploy("project.eth", admin.address);

    await registrar.grantRole(await registrar.MINTER_ROLE(), minter.address);
    await registrar.grantRole(await registrar.SIGNER_ROLE(), signer.address);

    return { registrar, admin, minter, signer, recipient, other };
  }

  it("mints and marks active", async function () {
    const { registrar, minter, recipient } = await deployFixture();
    const now = (await ethers.provider.getBlock("latest")).timestamp;

    await registrar.connect(minter).mintSubname("alice", recipient.address, now + 3600);
    expect(await registrar.isActive("alice")).to.equal(true);
  });

  it("revokes subname", async function () {
    const { registrar, minter, recipient } = await deployFixture();
    const now = (await ethers.provider.getBlock("latest")).timestamp;

    await registrar.connect(minter).mintSubname("bob", recipient.address, now + 3600);
    await registrar.connect(minter).revokeSubname("bob");

    expect(await registrar.isActive("bob")).to.equal(false);
  });

  it("renews subname", async function () {
    const { registrar, minter, recipient } = await deployFixture();
    const now = (await ethers.provider.getBlock("latest")).timestamp;

    await registrar.connect(minter).mintSubname("carol", recipient.address, now + 100);
    await registrar.connect(minter).renewSubname("carol", now + 9999);

    expect(await registrar.isActive("carol")).to.equal(true);
  });

  it("mints with valid signer authorization", async function () {
    const { registrar, signer, recipient } = await deployFixture();
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const nonce = await registrar.nonces(recipient.address);
    const deadline = now + 1200;
    const expiresAt = now + 3600;

    const domain = {
      name: "ENSSubnameRegistrar",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await registrar.getAddress(),
    };

    const types = {
      MintAuthorization: [
        { name: "recipient", type: "address" },
        { name: "label", type: "string" },
        { name: "expiresAt", type: "uint64" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const value = {
      recipient: recipient.address,
      label: "dave",
      expiresAt,
      nonce,
      deadline,
    };

    const signature = await signer.signTypedData(domain, types, value);

    await registrar
      .connect(recipient)
      .mintWithSignature("dave", recipient.address, expiresAt, deadline, signature);

    expect(await registrar.isActive("dave")).to.equal(true);
  });

  it("rejects invalid signature", async function () {
    const { registrar, other, recipient } = await deployFixture();
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const nonce = await registrar.nonces(recipient.address);
    const deadline = now + 1200;
    const expiresAt = now + 3600;

    const domain = {
      name: "ENSSubnameRegistrar",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await registrar.getAddress(),
    };

    const types = {
      MintAuthorization: [
        { name: "recipient", type: "address" },
        { name: "label", type: "string" },
        { name: "expiresAt", type: "uint64" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const value = {
      recipient: recipient.address,
      label: "eve",
      expiresAt,
      nonce,
      deadline,
    };

    const badSignature = await other.signTypedData(domain, types, value);

    await expect(
      registrar
        .connect(recipient)
        .mintWithSignature("eve", recipient.address, expiresAt, deadline, badSignature)
    ).to.be.revertedWithCustomError(registrar, "InvalidAuthorization");
  });
});
