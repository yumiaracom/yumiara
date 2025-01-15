export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StructuredMessage {
  explanation: string;
  decision: boolean;
}

export interface SendMessageOptions {
  messages: Message[];
  maxTokens?: number;
}
