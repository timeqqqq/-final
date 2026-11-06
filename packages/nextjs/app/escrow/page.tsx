"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import type { NextPage } from "next";
import { Address as AddressType, formatUnits, isAddress, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import {
  useDeployedContractInfo,
  useScaffoldEventHistory,
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";

const STATUS = ["Created", "Paid", "Completed", "Refunded", "Disputed"] as const;
type Order = {
  buyer: AddressType;
  seller: AddressType;
  token: AddressType;
  amount: bigint;
  deadline: bigint;
  status: number;
  description: string;
};
type Action = "pay" | "confirm" | "dispute" | "sellerWins" | "refundBuyer";
const sameAddress = (a?: string, b?: string) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

const EscrowPage: NextPage = () => {
  const { address } = useAccount();
  const [seller, setSeller] = useState("");
  const [amount, setAmount] = useState("30");
  const [minutes, setMinutes] = useState("30");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [active, setActive] = useState<string>();

  const { data: escrow } = useDeployedContractInfo({ contractName: "Escrow" });
  const { data: token } = useDeployedContractInfo({ contractName: "jsbToken" });
  const { data: arbiter } = useScaffoldReadContract({ contractName: "Escrow", functionName: "arbiter" });
  const { data: balance } = useScaffoldReadContract({
    contractName: "jsbToken",
    functionName: "balanceOf",
    args: [address],
  });
  const {
    data: events,
    isLoading,
    error,
  } = useScaffoldEventHistory({
    contractName: "Escrow",
    eventName: "OrderCreated",
    watch: true,
    blocksBatchSize: 10,
  });
  const { writeContractAsync: writeEscrow } = useScaffoldWriteContract({ contractName: "Escrow" });
  const { writeContractAsync: writeToken } = useScaffoldWriteContract({ contractName: "jsbToken" });

  const ids = useMemo(() => {
    const values = new Set<bigint>();
    events?.forEach(event => event.args.id !== undefined && values.add(event.args.id));
    return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }, [events]);

  const role = useMemo(() => {
    if (!address) return "未连接钱包";
    if (sameAddress(address, arbiter)) return "仲裁人";
    const buyer = events?.some(event => sameAddress(address, event.args.buyer));
    const sellerRole = events?.some(event => sameAddress(address, event.args.seller));
    if (buyer && sellerRole) return "买家 / 卖家";
    return buyer ? "买家" : sellerRole ? "卖家" : "旁观者";
  }, [address, arbiter, events]);

  const createOrder = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (!token?.address) return setMessage("没有找到 jsbToken 部署地址");
    if (!isAddress(seller)) return setMessage("卖家地址格式不正确");
    if (sameAddress(address, seller)) return setMessage("买家和卖家不能相同");
    try {
      const tokenAmount = parseUnits(amount, 18);
      const duration = Number(minutes);
      if (tokenAmount <= 0n || !Number.isFinite(duration) || duration <= 0) {
        throw new Error("金额和截止时间必须大于 0");
      }
      setActive("create");
      const hash = await writeEscrow({
        functionName: "createOrder",
        args: [
          seller,
          token.address,
          tokenAmount,
          BigInt(Math.floor(Date.now() / 1000) + Math.floor(duration * 60)),
          description,
        ],
      });
      if (hash) {
        setDescription("");
        setMessage("订单创建成功，正在等待事件列表刷新。");
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "创建订单失败");
    } finally {
      setActive(undefined);
    }
  };

  const act = async (action: Action, id: bigint, order: Order) => {
    setMessage("");
    setActive(action + "-" + id);
    try {
      if (action === "pay") {
        if (!escrow?.address) throw new Error("没有找到 Escrow 部署地址");
        const approval = await writeToken({
          functionName: "approve",
          args: [escrow.address, order.amount],
        });
        if (!approval) return;
        const deposit = await writeEscrow({ functionName: "deposit", args: [id] });
        if (deposit) setMessage("订单 #" + id + " 付款成功。");
      } else if (action === "confirm") {
        const hash = await writeEscrow({ functionName: "confirm", args: [id] });
        if (hash) setMessage("订单 #" + id + " 已确认收货。");
      } else if (action === "dispute") {
        const hash = await writeEscrow({ functionName: "dispute", args: [id] });
        if (hash) setMessage("订单 #" + id + " 已进入争议状态。");
      } else {
        const hash = await writeEscrow({
          functionName: "resolve",
          args: [id, action === "sellerWins"],
        });
        if (hash) setMessage("订单 #" + id + " 仲裁完成。");
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "交易失败");
    } finally {
      setActive(undefined);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl grow flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-base-200 p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-primary">POTOS Testnet</p>
            <h1 className="m-0 text-3xl font-bold">Escrow 托管交易</h1>
            <p className="mt-2 text-base-content/70">创建订单、支付代币、确认收货、发起争议并完成仲裁。</p>
          </div>
          <div className="rounded-2xl bg-base-100 px-5 py-3">
            <div className="text-sm text-base-content/60">当前角色</div>
            <div className="text-xl font-bold text-primary">{role}</div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
          <Info label="当前账户">
            <Address address={address} />
          </Info>
          <Info label="仲裁人">
            <Address address={arbiter} />
          </Info>
          <Info label="JSB 余额">{balance === undefined ? "—" : formatUnits(balance, 18) + " JSB"}</Info>
        </div>
      </section>

      <section className="rounded-3xl bg-base-100 p-6 shadow-sm">
        <h2 className="mt-0 text-2xl font-bold">创建订单</h2>
        <form onSubmit={createOrder} className="grid gap-4 md:grid-cols-2">
          <Field label="卖家地址" wide>
            <input
              className="input input-bordered w-full"
              value={seller}
              onChange={e => setSeller(e.target.value.trim())}
              placeholder="0x…"
              required
            />
          </Field>
          <Field label="金额（JSB）">
            <input
              className="input input-bordered w-full"
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </Field>
          <Field label="距离截止时间（分钟）">
            <input
              className="input input-bordered w-full"
              type="number"
              min="1"
              step="1"
              value={minutes}
              onChange={e => setMinutes(e.target.value)}
              required
            />
          </Field>
          <Field label="订单描述" wide>
            <input
              className="input input-bordered w-full"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="例如：大作业订金"
              required
            />
          </Field>
          <div className="md:col-span-2">
            <button className="btn btn-primary" disabled={!address || Boolean(active)}>
              {active === "create" && <span className="loading loading-spinner loading-sm" />}
              创建订单
            </button>
          </div>
        </form>
      </section>

      {message && <div className="alert alert-info break-all">{message}</div>}

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="m-0 text-2xl font-bold">订单列表</h2>
            <p className="mb-0 mt-1 text-sm text-base-content/60">数据来自 OrderCreated 事件和链上订单状态。</p>
          </div>
          <span className="badge badge-lg">{ids.length} 笔</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : error ? (
          <div className="alert alert-error">事件读取失败：{error.message}</div>
        ) : ids.length === 0 ? (
          <div className="rounded-3xl bg-base-200 p-10 text-center text-base-content/60">暂无订单</div>
        ) : (
          <div className="grid gap-5">
            {ids.map(id => (
              <OrderCard
                key={id.toString()}
                id={id}
                account={address}
                arbiter={arbiter}
                active={active}
                onAction={act}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

const OrderCard = ({
  id,
  account,
  arbiter,
  active,
  onAction,
}: {
  id: bigint;
  account?: AddressType;
  arbiter?: AddressType;
  active?: string;
  onAction: (action: Action, id: bigint, order: Order) => Promise<void>;
}) => {
  const { data, isLoading, error } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "getOrder",
    args: [id],
  });
  const order = data as unknown as Order | undefined;
  if (isLoading) return <div className="skeleton h-48 w-full rounded-3xl" />;
  if (error || !order) return <div className="alert alert-error">订单 #{id.toString()} 读取失败</div>;

  const status = Number(order.status);
  const buyer = sameAddress(account, order.buyer);
  const seller = sameAddress(account, order.seller);
  const arbitrator = sameAddress(account, arbiter);
  const orderRole = arbitrator ? "仲裁人" : buyer ? "买家" : seller ? "卖家" : "旁观者";
  const busy = (action: Action) => active === action + "-" + id;
  const disabled = Boolean(active);
  const actionable = (status === 0 && buyer) || (status === 1 && (buyer || seller)) || (status === 4 && arbitrator);

  return (
    <article className="rounded-3xl bg-base-100 p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-xl font-bold">订单 #{id.toString()}</h3>
            <span
              className={"badge " + (status === 4 ? "badge-warning" : status === 2 ? "badge-success" : "badge-primary")}
            >
              {STATUS[status] || "Unknown (" + status + ")"}
            </span>
            <span className="badge badge-outline">你是{orderRole}</span>
          </div>
          <p className="mb-0 mt-2 text-base-content/70">{order.description || "无描述"}</p>
        </div>
        <div className="sm:text-right">
          <div className="text-2xl font-bold">{formatUnits(order.amount, 18)} JSB</div>
          <div className="text-xs text-base-content/60">
            截止：{new Date(Number(order.deadline) * 1000).toLocaleString()}
          </div>
        </div>
      </div>
      <div className="my-5 grid gap-3 md:grid-cols-3">
        <Info label="买家">
          <Address address={order.buyer} />
        </Info>
        <Info label="卖家">
          <Address address={order.seller} />
        </Info>
        <Info label="代币合约">
          <Address address={order.token} />
        </Info>
      </div>
      <div className="flex flex-wrap gap-2">
        {status === 0 && buyer && (
          <ActionButton
            label="付款（approve → deposit）"
            loading={busy("pay")}
            disabled={disabled}
            onClick={() => onAction("pay", id, order)}
          />
        )}
        {status === 1 && buyer && (
          <ActionButton
            label="确认收货"
            loading={busy("confirm")}
            disabled={disabled}
            onClick={() => onAction("confirm", id, order)}
          />
        )}

        {status === 1 && (buyer || seller) && (
          <ActionButton
            label="发起争议"
            loading={busy("dispute")}
            disabled={disabled}
            styleName="btn-warning"
            onClick={() => onAction("dispute", id, order)}
          />
        )}
        {status === 4 && arbitrator && (
          <>
            <ActionButton
              label="判给卖家"
              loading={busy("sellerWins")}
              disabled={disabled}
              onClick={() => onAction("sellerWins", id, order)}
            />
            <ActionButton
              label="退给买家"
              loading={busy("refundBuyer")}
              disabled={disabled}
              styleName="btn-secondary"
              onClick={() => onAction("refundBuyer", id, order)}
            />
          </>
        )}
        {!actionable && <span className="text-sm text-base-content/60">当前账户在此状态下没有可执行操作。</span>}
      </div>
    </article>
  );
};

const Field = ({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) => (
  <label className={"form-control " + (wide ? "md:col-span-2" : "")}>
    <span className="mb-2 text-sm font-semibold">{label}</span>
    {children}
  </label>
);

const Info = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0 rounded-2xl bg-base-200 px-4 py-3">
    <div className="mb-1 text-xs text-base-content/60">{label}</div>
    <div className="min-w-0 break-all font-medium">{children}</div>
  </div>
);

const ActionButton = ({
  label,
  loading,
  disabled,
  styleName = "btn-primary",
  onClick,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  styleName?: string;
  onClick: () => void;
}) => (
  <button type="button" className={"btn " + styleName} disabled={disabled} onClick={onClick}>
    {loading && <span className="loading loading-spinner loading-sm" />}
    {label}
  </button>
);

export default EscrowPage;
