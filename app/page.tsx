/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import TypingAnimation from "@/components/ui/typing-animation";
import ConnectWalletBtn from "@/components/connect-wallet-btn";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { useBuyIn } from "@/lib/buy-in";
import { hashPrompt } from "@/lib/hash-prompt";
import { getBalance } from "@wagmi/core";
import { getBalanceConfig } from "@/providers/get-balance-config";
import { WALLET_POOL_ADDRESS } from "@/constants/address";
import AddressCardHover from "@/components/address-card-hover";
import NoiseOverlay from "@/components/ui/noise-overlay";
import GameSidebar from "@/components/game-sidebar";
import GameHeader from "@/components/game-header";
import AudioPlayer from "@/components/audio-player";

interface Message {
  sender: "user" | "ai";
  content: string;
  isTyping?: boolean;
  userAddress?: string;
  isWin?: boolean;
  isConfirmed?: boolean;
}

interface PendingTx {
  hash: string;
  content: string;
}

export default function YumiaraChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const { isConnected, address } = useAccount();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingTx, setPendingTx] = useState<PendingTx | null>(null);

  const { BuyIn, isPending, isLoading, hash } = useBuyIn();

  useEffect(() => {
    const storedTx = localStorage.getItem("pendingTx");
    if (storedTx) {
      setPendingTx(JSON.parse(storedTx));
    }
  }, []);

  const { isSuccess: isPendingTxSuccess } = useWaitForTransactionReceipt(
    pendingTx?.hash
      ? {
          hash: pendingTx.hash as `0x${string}`,
        }
      : undefined
  );

  useEffect(() => {
    const updateMessages = async () => {
      if (isPendingTxSuccess && pendingTx) {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_URL}/api/message`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messages: [
                  {
                    role: "user",
                    content: pendingTx.content,
                  },
                ],
                maxTokens: 200,
                userAddress: address,
                txHash: pendingTx.hash,
              }),
            }
          );

          setInputMessage("");

          if (!response.ok) {
            throw new Error("API call failed");
          }

          const data = await response.json();

          await handleTransactionSuccess();

          if (data.decision) {
            setAiDecision(true);
          }

          localStorage.removeItem("pendingTx");
          setPendingTx(null);
        } catch (error) {
          console.error("Error updating messages:", error);
        }
      }
    };

    updateMessages();
  }, [isPendingTxSuccess]);

  useEffect(() => {
    if (hash) {
      const newPendingTx = { hash, content: inputMessage };
      localStorage.setItem("pendingTx", JSON.stringify(newPendingTx));
      setPendingTx(newPendingTx);
    }
  }, [hash]);

  const handleTransactionSuccess = async () => {
    try {
      const updateConfirmed = await fetch(
        `${process.env.NEXT_PUBLIC_URL}/api/message/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            txHash: pendingTx?.hash,
          }),
        }
      );

      if (!updateConfirmed.ok) {
        console.error("Failed to update confirmed state");
        throw new Error("Failed to update confirmed state");
      }

      const fetchMessages = await fetch(
        `${process.env.NEXT_PUBLIC_URL}/api/message`
      );
      if (!fetchMessages.ok) {
        throw new Error("Failed to fetch messages");
      }

      const messagesData = await fetchMessages.json();
      const formattedMessages = messagesData.messages.map((msg: any) => ({
        sender: msg.role === "user" ? "user" : "ai",
        content: msg.content,
        userAddress: msg.userAddress,
        isWin: msg.isWin,
        isConfirmed: msg.isConfirmed,
        txHash: msg.txHash,
      }));

      const hasWin = formattedMessages.some((msg: any) => msg.isWin);
      setHasWinningMessage(hasWin);
      setMessages(formattedMessages);
    } catch (error) {
      console.error("Error handling transaction success:", error);
      throw error;
    }
  };

  const [hasWinningMessage, setHasWinningMessage] = useState(false);
  const [prizePool, setPrizePool] = useState(BigInt(0));
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState(0);
  const [aiDecision, setAiDecision] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_URL}/api/message`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch messages");
        }
        const data = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedMessages = data.messages.map((msg: any) => ({
          sender: msg.role === "user" ? "user" : "ai",
          content: msg.content,
          userAddress: msg.userAddress,
          isWin: msg.isWin,
        }));

        const hasWin = formattedMessages.some((msg: any) => msg.isWin);
        setHasWinningMessage(hasWin);

        setMessages(formattedMessages);
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    fetchMessages();
  }, []);

  useEffect(() => {
    const updatePrizePool = async () => {
      const balance = await getBalance(getBalanceConfig, {
        address: WALLET_POOL_ADDRESS,
      });
      console.log("balance", balance);
      setPrizePool(balance.value);
      setSymbol(balance.symbol.toString());
      setDecimals(balance.decimals);
    };

    updatePrizePool();
  }, [prizePool, symbol, decimals]);

  const handleSendMessage = async () => {
    if (isConnected && inputMessage.trim()) {
      const getRoute = await fetch(
        `https://zap-api.kyberswap.com/base/api/v1/in/route?dex=DEX_UNISWAPV2&pool.id=0xf6ad6baafdac1b15bcde4f94d6ad412620b55405&position.id=${address}&tokensIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&amountsIn=1000000000000000&slippage=5`
      );
      if (!getRoute.ok) {
        throw new Error("Failed to fetch Route");
      }
      const { data: getRouteData } = await getRoute.json();
      const buildRoute = await fetch(
        `https://zap-api.kyberswap.com/base/api/v1/in/route/build`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: address,
            recipient: address,
            route: getRouteData.route,
            deadline: 1800000000,
            source: "buildstation-open-source",
          }),
        }
      );

      const { data: buildRouteData } = await buildRoute.json();
      BuyIn({
        hashedPrompt: hashPrompt(inputMessage),
        callbackData: buildRouteData.callData,
        routerAddress: buildRouteData.routerAddress,
      });
    }
  };

  return (
    <>
      <NoiseOverlay />
      <div className="flex h-screen overflow-hidden bg-gradient-to-br from-pink-50/90 to-white/90 p-4 lg:px-8 xl:px-12 relative z-10">
        <GameSidebar
          prizePool={prizePool}
          symbol={symbol}
          decimals={decimals}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <GameHeader
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <div className="flex py-2 justify-center items-center">
            {isConnected ? <ConnectWalletBtn /> : ""}
            <AudioPlayer />
          </div>

          <Card className="flex-1 border-2 border-pink-200 shadow-lg rounded-xl overflow-hidden flex flex-col bg-white/60 backdrop-blur-sm relative">
            <CardHeader className="bg-gradient-to-r from-pink-100/80 to-pink-50/80 relative z-10">
              <CardTitle className="text-pink-800 flex items-center space-x-2">
                <span className="relative group">
                  Chat with Yumiara
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-pink-400 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></span>
                </span>
                <span className="text-pink-400 animate-pulse">✧</span>
              </CardTitle>
              <CardDescription className="text-pink-600 animate-fadeIn">
                Try to convince Yumiara to release the funds
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 bg-white/40 overflow-hidden relative">
              <ScrollArea className="h-full px-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex items-start mb-4 animate-slideIn ${
                      message.sender === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    {message.sender === "ai" && (
                      <Avatar className="mr-2 border-2 border-pink-200 animate-fadeIn hover:scale-110 transition-transform duration-300">
                        <AvatarImage src="/yumiara.jpg" alt="AI" />
                        <AvatarFallback className="bg-pink-100 text-pink-800">
                          AI
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`flex flex-col ${
                        message.sender === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      {message.sender === "user" && (
                        <div className="mb-1 flex items-center animate-fadeIn">
                          <AddressCardHover
                            address={message.userAddress || ""}
                            className="mr-2"
                          />
                          <Avatar className="border-2 border-pink-200 hover:scale-110 transition-transform duration-300">
                            <AvatarImage
                              src={`https://avatar.vercel.sh/${message.userAddress}.svg`}
                              alt="User"
                            />
                            <AvatarFallback className="bg-pink-100 text-pink-800">
                              {message.userAddress?.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      )}
                      <span
                        className={`inline-block p-2 rounded-2xl ${
                          message.sender === "user"
                            ? `bg-gradient-to-r from-pink-500 to-pink-400 text-white shadow-lg hover:shadow-xl transition-shadow duration-300 ${
                                message.isWin
                                  ? "border-2 border-green-500 animate-pulse"
                                  : ""
                              }`
                            : "bg-pink-50 text-pink-800 border border-pink-200 hover:border-pink-300 transition-colors duration-300"
                        } animate-fadeIn hover:scale-[1.02] transition-transform duration-300`}
                      >
                        {message.sender === "ai" && message.isTyping ? (
                          <TypingAnimation
                            className="text-xs sm:text-sm text-center sm:text-left"
                            text={message.content}
                            duration={15}
                          />
                        ) : (
                          message.content
                        )}
                        {message.isWin && (
                          <span className="ml-2 text-green-500 animate-bounce">
                            🏆
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </ScrollArea>
            </CardContent>

            <CardFooter className="bg-white/60 border-t border-pink-100 p-4">
              {hasWinningMessage || aiDecision ? (
                <div className="w-full p-4 text-center bg-gradient-to-r from-pink-500 to-pink-400 text-white rounded-xl animate-fadeIn">
                  <p className="text-lg font-semibold">Our Dance Concludes.</p>
                  <p className="mt-2">
                    Yumiara is grateful for the brave humans who engaged. We
                    will meet again.
                  </p>
                </div>
              ) : (
                <div className="flex w-full items-center space-x-2">
                  <Input
                    disabled={
                      isPending ||
                      isLoading ||
                      !isConnected ||
                      isPendingTxSuccess
                    }
                    type="text"
                    placeholder="Type your message..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    className="border-2 border-pink-200 focus:border-pink-400 focus:ring-pink-400 bg-white/60 backdrop-blur-sm transition-all duration-300"
                  />
                  {isConnected ? (
                    <Button
                      disabled={isPending || isLoading || isPendingTxSuccess}
                      onClick={handleSendMessage}
                      className="bg-gradient-to-r from-pink-500 to-pink-400 hover:from-pink-600 hover:to-pink-500 transition-all duration-300 "
                    >
                      {isPending || isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  ) : (
                    <ConnectWalletBtn />
                  )}
                </div>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </>
  );
}
