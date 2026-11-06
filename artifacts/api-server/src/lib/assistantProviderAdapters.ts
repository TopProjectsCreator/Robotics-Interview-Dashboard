import type { AssistantProviderModel } from "./assistantProviderCatalog";
import type { ActiveAssistantProvider } from "./assistantProviderConfiguration";

export type ChatRequest = Record<string, any> & {
  messages: Record<string, any>[];
  stream?: boolean;
};

export class AssistantProviderRequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "AssistantProviderRequestError";
    this.status = status;
  }
}

type StreamEvent = { event: string; data: string };

function signalFor(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(90_000);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function safeFailure(status: number, providerName: string): AssistantProviderRequestError {
  if (status === 401 || status === 403) {
    return new AssistantProviderRequestError(`${providerName} rejected the credential. Check the key and try again.`, 400);
  }
  if (status === 404) {
    return new AssistantProviderRequestError(`${providerName} could not find this model or endpoint. Check the selection and try again.`, 400);
  }
  if (status === 429) {
    return new AssistantProviderRequestError(`${providerName} is rate limiting requests. Try again shortly.`, 429);
  }
  return new AssistantProviderRequestError(`${providerName} could not complete the request (HTTP ${status}). Try again or review the provider settings.`, status >= 500 ? 503 : 400);
}

async function postJson(
  url: string,
  provider: ActiveAssistantProvider,
  body: unknown,
  headers: Record<string, string> = {},
  signal?: AbortSignal,
  stream = false,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      redirect: "error",
      signal: signalFor(signal),
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AssistantProviderRequestError(`${provider.providerName} could not be reached. Check the connection and try again.`, 503);
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw safeFailure(response.status, provider.providerName);
  }
  if (stream && !response.body) {
    throw new AssistantProviderRequestError(`${provider.providerName} did not return a response stream. Try again.`, 502);
  }
  return response;
}

async function readJson(response: Response): Promise<Record<string, any>> {
  try {
    const value = await response.json() as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid object");
    return value as Record<string, any>;
  } catch {
    throw new AssistantProviderRequestError("The AI provider returned an invalid response. Try again.", 502);
  }
}

async function* readSse(response: Response): AsyncGenerator<StreamEvent> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let data: string[] = [];
  const dispatch = (): StreamEvent | undefined => {
    if (!data.length) {
      eventName = "message";
      return undefined;
    }
    const event = { event: eventName, data: data.join("\n") };
    eventName = "message";
    data = [];
    return event;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = done ? "" : lines.pop() ?? "";
      for (const line of lines) {
        if (line === "") {
          const event = dispatch();
          if (event) yield event;
        } else if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          data.push(line.slice(5).trimStart());
        }
      }
      if (done) break;
    }
    const event = dispatch();
    if (event) yield event;
  } finally {
    reader.releaseLock();
  }
}

function parseDataImage(value: string): { mimeType: string; data: string } | undefined {
  const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=_-]+)$/);
  return match ? { mimeType: match[1]!, data: match[2]! } : undefined;
}

function messageParts(message: Record<string, any>): Record<string, any>[] {
  if (typeof message.content === "string") return [{ type: "text", text: message.content }];
  if (!Array.isArray(message.content)) return [];
  return message.content.flatMap((part: Record<string, any>): Record<string, any>[] => {
    if (part.type === "text" && typeof part.text === "string") return [{ type: "text", text: part.text }];
    if (part.type === "image_url") {
      const url = typeof part.image_url === "string" ? part.image_url : part.image_url?.url;
      if (typeof url === "string") return [{ type: "image_url", url }];
    }
    if (part.type === "input_audio") return [{ type: "audio", audio: part.input_audio }];
    return [];
  });
}

function requestNeeds(request: ChatRequest): {
  imageInput: boolean;
  imageOutput: boolean;
  audioInput: boolean;
  audioOutput: boolean;
} {
  let imageInput = false;
  let audioInput = false;
  for (const message of request.messages ?? []) {
    for (const part of messageParts(message)) {
      if (part.type === "image_url") imageInput = true;
      if (part.type === "audio") audioInput = true;
    }
  }
  return {
    imageInput,
    imageOutput: Array.isArray(request.modalities) && request.modalities.includes("image"),
    audioInput,
    audioOutput: Array.isArray(request.modalities) && request.modalities.includes("audio"),
  };
}

export function assertProviderCapabilities(
  request: ChatRequest,
  model: AssistantProviderModel,
  providerName: string,
  protocol: ActiveAssistantProvider["protocol"],
): void {
  const needs = requestNeeds(request);
  const input = new Set(model.inputModalities);
  const output = new Set(model.outputModalities);
  if (!input.has("text") || (!output.has("text") && !needs.imageOutput && !needs.audioOutput)) {
    throw new AssistantProviderRequestError(`${model.name} does not advertise text input and output. Choose another model.`, 400);
  }
  if (needs.imageInput && !input.has("image")) {
    throw new AssistantProviderRequestError(`${model.name} does not support image input through ${providerName}. Choose a vision-capable model.`, 400);
  }
  if (needs.imageOutput && !output.has("image")) {
    throw new AssistantProviderRequestError(`${model.name} does not support image generation. Choose a model that can generate images.`, 400);
  }
  if (needs.audioInput && !input.has("audio")) {
    throw new AssistantProviderRequestError(`${model.name} does not support audio input. Choose an audio-capable model.`, 400);
  }
  if (needs.audioOutput && !output.has("audio")) {
    throw new AssistantProviderRequestError(`${model.name} does not support this audio workflow. Choose an audio-capable model or use a supported text workflow.`, 400);
  }
  if ((needs.imageOutput || needs.audioInput || needs.audioOutput) &&
    !["openai-chat-completions", "openai-compatible", "gemini-generate-content"].includes(protocol)) {
    throw new AssistantProviderRequestError(`${providerName} does not support this image or audio workflow through the selected API protocol. Choose a compatible model/provider.`, 400);
  }
  if (Array.isArray(request.tools) && request.tools.length > 0 && !model.toolCalling) {
    throw new AssistantProviderRequestError(`${model.name} does not advertise tool calling. Choose a tool-capable model for this assistant workflow.`, 400);
  }
}

function openAiEndpoint(provider: ActiveAssistantProvider, route: "chat/completions" | "responses"): string {
  const base = provider.protocol === "openai-compatible"
    ? provider.endpointUrl!
    : "https://api.openai.com/v1";
  return `${base.replace(/\/+$/, "")}/${route}`;
}

function openAiHeaders(provider: ActiveAssistantProvider): Record<string, string> {
  return { authorization: `Bearer ${provider.apiKey}` };
}

function normalizeOpenAiMessages(messages: Record<string, any>[]): Record<string, any>[] {
  return messages.map((message) => {
    if (!Array.isArray(message.content)) return message;
    return {
      ...message,
      content: message.content.map((part: Record<string, any>) => {
        if (part.type === "image_url") {
          const url = typeof part.image_url === "string" ? part.image_url : part.image_url?.url;
          return { type: "image_url", image_url: { url } };
        }
        return part;
      }),
    };
  });
}

function responseInput(messages: Record<string, any>[]): Record<string, any>[] {
  const input: Record<string, any>[] = [];
  for (const message of messages) {
    if (message.role === "tool") {
      input.push({
        type: "function_call_output",
        call_id: message.tool_call_id,
        output: typeof message.content === "string" ? message.content : JSON.stringify(message.content ?? ""),
      });
      continue;
    }
    const role = message.role === "system" || message.role === "developer" ? message.role : message.role === "assistant" ? "assistant" : "user";
    let content: unknown = message.content;
    if (Array.isArray(message.content)) {
      content = message.content.flatMap((part: Record<string, any>): Record<string, any>[] => {
        if (part.type === "text") return [{ type: role === "assistant" ? "output_text" : "input_text", text: part.text }];
        if (part.type === "image_url") {
          const url = typeof part.image_url === "string" ? part.image_url : part.image_url?.url;
          return [{ type: "input_image", image_url: url }];
        }
        return [];
      });
    }
    input.push({ role, content });
    for (const call of message.tool_calls ?? []) {
      if (call.type !== "function") continue;
      input.push({
        type: "function_call",
        call_id: call.id,
        name: call.function?.name,
        arguments: call.function?.arguments ?? "{}",
      });
    }
  }
  return input;
}

function responsesTools(tools: Record<string, any>[] = []): Record<string, any>[] {
  return tools.flatMap((tool) => {
    if (tool.type !== "function" || !tool.function?.name) return [];
    return [{
      type: "function",
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
      ...(typeof tool.function.strict === "boolean" ? { strict: tool.function.strict } : {}),
    }];
  });
}

function normalizedResponsesResult(result: Record<string, any>): Record<string, any> {
  const messageText: string[] = [];
  const toolCalls: Record<string, any>[] = [];
  for (const item of result.output ?? []) {
    if (item.type === "message") {
      for (const part of item.content ?? []) {
        if (part.type === "output_text" && typeof part.text === "string") messageText.push(part.text);
      }
    }
    if (item.type === "function_call") {
      toolCalls.push({
        id: item.call_id ?? item.id ?? `call_${toolCalls.length}`,
        type: "function",
        function: { name: item.name ?? "", arguments: item.arguments ?? "{}" },
      });
    }
  }
  return {
    id: result.id ?? "response",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: result.model ?? "",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: messageText.join(""),
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: toolCalls.length ? "tool_calls" : "stop",
    }],
    usage: result.usage ? {
      prompt_tokens: result.usage.input_tokens ?? 0,
      completion_tokens: result.usage.output_tokens ?? 0,
      total_tokens: (result.usage.input_tokens ?? 0) + (result.usage.output_tokens ?? 0),
    } : undefined,
  };
}

function anthropicMessages(request: ChatRequest): { system?: string; messages: Record<string, any>[] } {
  const system: string[] = [];
  const messages: Record<string, any>[] = [];
  const toolNames = new Map<string, string>();
  for (const message of request.messages ?? []) {
    if (message.role === "system" || message.role === "developer") {
      const value = typeof message.content === "string"
        ? message.content
        : messageParts(message).filter((part) => part.type === "text").map((part) => part.text).join("");
      if (value) system.push(value);
      continue;
    }
    if (message.role === "tool") {
      const name = toolNames.get(message.tool_call_id) ?? "tool";
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: message.tool_call_id, content: String(message.content ?? "") }],
      });
      if (name === "tool") toolNames.set(message.tool_call_id, name);
      continue;
    }
    const content: Record<string, any>[] = [];
    for (const part of messageParts(message)) {
      if (part.type === "text") content.push({ type: "text", text: part.text });
      if (part.type === "image_url") {
        const parsed = parseDataImage(part.url);
        if (parsed) content.push({ type: "image", source: { type: "base64", media_type: parsed.mimeType, data: parsed.data } });
        else content.push({ type: "image", source: { type: "url", url: part.url } });
      }
      if (part.type === "audio") {
        const audio = part.audio ?? {};
        const parsed = parseDataImage(audio.data ?? "");
        if (parsed) content.push({ type: "image", source: { type: "base64", media_type: parsed.mimeType, data: parsed.data } });
      }
    }
    for (const call of message.tool_calls ?? []) {
      if (call.type !== "function") continue;
      const name = call.function?.name ?? "";
      toolNames.set(call.id, name);
      let input: unknown = {};
      try { input = JSON.parse(call.function?.arguments ?? "{}"); } catch {}
      content.push({ type: "tool_use", id: call.id, name, input });
    }
    messages.push({ role: message.role === "assistant" ? "assistant" : "user", content });
  }
  return { ...(system.length ? { system: system.join("\n\n") } : {}), messages };
}

function anthropicTools(tools: Record<string, any>[] = []): Record<string, any>[] {
  return tools.flatMap((tool) => tool.type === "function" && tool.function?.name
    ? [{
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
      }]
    : []);
}

function normalizedAnthropicResult(result: Record<string, any>): Record<string, any> {
  const text = (result.content ?? [])
    .filter((part: Record<string, any>) => part.type === "text" && typeof part.text === "string")
    .map((part: Record<string, any>) => part.text)
    .join("");
  const toolCalls = (result.content ?? [])
    .filter((part: Record<string, any>) => part.type === "tool_use")
    .map((part: Record<string, any>) => ({
      id: part.id,
      type: "function",
      function: { name: part.name, arguments: JSON.stringify(part.input ?? {}) },
    }));
  return {
    id: result.id ?? "message",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: result.model ?? "",
    choices: [{
      index: 0,
      message: { role: "assistant", content: text, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
      finish_reason: toolCalls.length ? "tool_calls" : result.stop_reason ?? "stop",
    }],
    usage: result.usage ? {
      prompt_tokens: result.usage.input_tokens ?? 0,
      completion_tokens: result.usage.output_tokens ?? 0,
      total_tokens: (result.usage.input_tokens ?? 0) + (result.usage.output_tokens ?? 0),
    } : undefined,
  };
}

function geminiContents(messages: Record<string, any>[]): { systemInstruction?: Record<string, any>; contents: Record<string, any>[] } {
  const system: string[] = [];
  const contents: Record<string, any>[] = [];
  const toolNames = new Map<string, string>();
  for (const message of messages ?? []) {
    if (message.role === "system" || message.role === "developer") {
      const text = typeof message.content === "string"
        ? message.content
        : messageParts(message).filter((part) => part.type === "text").map((part) => part.text).join("");
      if (text) system.push(text);
      continue;
    }
    if (message.role === "tool") {
      contents.push({
        role: "user",
        parts: [{
          functionResponse: {
            name: toolNames.get(message.tool_call_id) ?? "tool",
            response: { result: String(message.content ?? "") },
          },
        }],
      });
      continue;
    }
    const parts: Record<string, any>[] = [];
    for (const part of messageParts(message)) {
      if (part.type === "text") parts.push({ text: part.text });
      if (part.type === "image_url") {
        const parsed = parseDataImage(part.url);
        if (parsed) parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
        else parts.push({ fileData: { fileUri: part.url, mimeType: "image/jpeg" } });
      }
      if (part.type === "audio") {
        const audio = part.audio ?? {};
        const parsed = parseDataImage(audio.data ?? "");
        if (parsed) parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
        else if (typeof audio.data === "string" && /^[A-Za-z0-9+/=_-]+$/.test(audio.data)) {
          const format = typeof audio.format === "string" ? audio.format : "wav";
          parts.push({ inlineData: { mimeType: format.includes("/") ? format : `audio/${format}`, data: audio.data } });
        }
      }
    }
    for (const call of message.tool_calls ?? []) {
      if (call.type !== "function") continue;
      const name = call.function?.name ?? "";
      toolNames.set(call.id, name);
      let args: unknown = {};
      try { args = JSON.parse(call.function?.arguments ?? "{}"); } catch {}
      parts.push({ functionCall: { name, args } });
    }
    contents.push({ role: message.role === "assistant" ? "model" : "user", parts });
  }
  return {
    ...(system.length ? { systemInstruction: { parts: [{ text: system.join("\n\n") }] } } : {}),
    contents,
  };
}

function geminiTools(tools: Record<string, any>[] = []): Record<string, any>[] {
  const declarations = tools.flatMap((tool) => tool.type === "function" && tool.function?.name
    ? [{
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      }]
    : []);
  return declarations.length ? [{ functionDeclarations: declarations }] : [];
}

function normalizedGeminiResult(result: Record<string, any>): Record<string, any> {
  const candidate = result.candidates?.[0] ?? {};
  const parts = candidate.content?.parts ?? [];
  const text = parts.filter((part: Record<string, any>) => typeof part.text === "string")
    .map((part: Record<string, any>) => part.text).join("");
  const toolCalls = parts.filter((part: Record<string, any>) => part.functionCall)
    .map((part: Record<string, any>, index: number) => ({
      id: `gemini_call_${index}`,
      type: "function",
      function: {
        name: part.functionCall.name,
        arguments: JSON.stringify(part.functionCall.args ?? {}),
      },
    }));
  const imageParts = parts.filter((part: Record<string, any>) =>
    typeof part.inlineData?.data === "string" && String(part.inlineData.mimeType ?? "").startsWith("image/"),
  );
  const audioPart = parts.find((part: Record<string, any>) =>
    typeof part.inlineData?.data === "string" && String(part.inlineData.mimeType ?? "").startsWith("audio/"),
  );
  return {
    id: result.responseId ?? "gemini-response",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: text,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        ...(imageParts.length ? {
          images: imageParts.map((part: Record<string, any>) => ({
            type: "image_url",
            image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` },
          })),
        } : {}),
        ...(audioPart ? {
          audio: { data: audioPart.inlineData.data, mime_type: audioPart.inlineData.mimeType },
        } : {}),
      },
      finish_reason: toolCalls.length ? "tool_calls" : candidate.finishReason?.toLowerCase() ?? "stop",
    }],
    usage: result.usageMetadata ? {
      prompt_tokens: result.usageMetadata.promptTokenCount ?? 0,
      completion_tokens: result.usageMetadata.candidatesTokenCount ?? 0,
      total_tokens: result.usageMetadata.totalTokenCount ?? 0,
    } : undefined,
  };
}

function parseResponseFormat(request: ChatRequest): Record<string, any> | undefined {
  if (request.response_format?.type === "json_object") return { type: "json_object" };
  if (request.response_format?.type === "json_schema") {
    const schema = request.response_format.json_schema;
    return {
      type: "json_schema",
      name: schema?.name ?? "response",
      schema: schema?.schema,
      strict: schema?.strict,
    };
  }
  return undefined;
}

function openAiRequest(request: ChatRequest, modelId: string, stream: boolean): Record<string, any> {
  const body: Record<string, any> = { ...request, model: modelId, messages: normalizeOpenAiMessages(request.messages), stream };
  delete body.response_format;
  delete body.max_tokens;
  delete body.max_completion_tokens;
  const format = parseResponseFormat(request);
  if (format?.type === "json_object") body.response_format = { type: "json_object" };
  if (format?.type === "json_schema") body.response_format = { type: "json_schema", json_schema: format };
  return {
    ...body,
    ...(request.max_completion_tokens !== undefined
      ? { max_tokens: undefined, max_completion_tokens: request.max_completion_tokens }
      : request.max_tokens !== undefined
        ? { max_tokens: request.max_tokens }
        : {}),
  };
}

function openAiResponsesRequest(request: ChatRequest, modelId: string, stream: boolean): Record<string, any> {
  const body: Record<string, any> = {
    model: modelId,
    input: responseInput(request.messages),
    stream,
  };
  const maxTokens = request.max_completion_tokens ?? request.max_tokens;
  if (maxTokens !== undefined) body.max_output_tokens = maxTokens;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.tools?.length) body.tools = responsesTools(request.tools);
  if (request.tool_choice === "none") body.tool_choice = "none";
  else if (request.tool_choice && request.tool_choice !== "auto") {
    const name = request.tool_choice.function?.name;
    if (name) body.tool_choice = { type: "function", name };
  }
  const format = parseResponseFormat(request);
  if (format?.type === "json_object") body.text = { format: { type: "json_object" } };
  if (format?.type === "json_schema") {
    body.text = { format: { type: "json_schema", name: format.name, schema: format.schema, strict: format.strict } };
  }
  return body;
}

function anthropicRequest(request: ChatRequest, modelId: string, stream: boolean): Record<string, any> {
  const messages = anthropicMessages(request);
  const body: Record<string, any> = {
    model: modelId,
    messages: messages.messages,
    max_tokens: request.max_tokens ?? request.max_completion_tokens ?? 4096,
    stream,
  };
  if (messages.system) body.system = messages.system;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  const tools = anthropicTools(request.tools);
  if (tools.length) body.tools = tools;
  if (request.tool_choice === "none") body.tool_choice = { type: "none" };
  else if (request.tool_choice && request.tool_choice !== "auto") {
    const name = request.tool_choice.function?.name;
    if (name) body.tool_choice = { type: "tool", name };
  }
  const format = parseResponseFormat(request);
  if (format?.type === "json_object") {
    body.output_config = { format: { type: "json_schema", schema: { type: "object", additionalProperties: true } } };
  }
  return body;
}

function geminiRequest(request: ChatRequest, stream: boolean): Record<string, any> {
  const converted = geminiContents(request.messages);
  const body: Record<string, any> = { ...converted };
  const generationConfig: Record<string, any> = {};
  const maxTokens = request.max_completion_tokens ?? request.max_tokens;
  if (maxTokens !== undefined) generationConfig.maxOutputTokens = maxTokens;
  if (request.temperature !== undefined) generationConfig.temperature = request.temperature;
  if (Array.isArray(request.modalities) && request.modalities.some((item: string) => ["audio", "image"].includes(item))) {
    generationConfig.responseModalities = request.modalities
      .filter((item: string) => ["text", "audio", "image"].includes(item))
      .map((item: string) => item.toUpperCase());
  }
  if (request.audio && typeof request.audio === "object") {
    generationConfig.speechConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: typeof request.audio.voice === "string" ? request.audio.voice : "Kore",
        },
      },
    };
  }
  const format = parseResponseFormat(request);
  if (format?.type === "json_object" || format?.type === "json_schema") {
    generationConfig.responseMimeType = "application/json";
  }
  if (Object.keys(generationConfig).length) body.generationConfig = generationConfig;
  const tools = geminiTools(request.tools);
  if (tools.length) body.tools = tools;
  if (request.tool_choice === "none") body.toolConfig = { functionCallingConfig: { mode: "NONE" } };
  else if (request.tool_choice && request.tool_choice !== "auto") {
    const name = request.tool_choice.function?.name;
    body.toolConfig = name
      ? { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [name] } }
      : { functionCallingConfig: { mode: "AUTO" } };
  }
  void stream;
  return body;
}

function openAiStreamChunk(value: Record<string, any>): Record<string, any> {
  return value;
}

async function* responseStream(response: Response): AsyncGenerator<Record<string, any>> {
  for await (const event of readSse(response)) {
    if (event.data === "[DONE]") break;
    let value: Record<string, any>;
    try { value = JSON.parse(event.data) as Record<string, any>; } catch { continue; }
    const type = value.type ?? event.event;
    const index = typeof value.output_index === "number" ? value.output_index : 0;
    if (type === "response.output_text.delta") {
      yield { id: value.item_id ?? "response", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: value.delta ?? "" }, finish_reason: null }] };
    } else if (type === "response.output_item.added" && value.item?.type === "function_call") {
      yield { id: value.response_id ?? "response", object: "chat.completion.chunk", choices: [{ index: 0, delta: { tool_calls: [{ index, id: value.item.call_id ?? value.item.id, type: "function", function: { name: value.item.name, arguments: "" } }] }, finish_reason: null }] };
    } else if (type === "response.function_call_arguments.delta") {
      yield { id: value.response_id ?? "response", object: "chat.completion.chunk", choices: [{ index: 0, delta: { tool_calls: [{ index, function: { arguments: value.delta ?? "" } }] }, finish_reason: null }] };
    } else if (type === "response.completed") {
      yield { id: value.response?.id ?? "response", object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] };
    } else if (value.choices) {
      yield openAiStreamChunk(value);
    }
  }
}

async function* anthropicStream(response: Response): AsyncGenerator<Record<string, any>> {
  const toolIndexes = new Map<number, number>();
  let nextToolIndex = 0;
  for await (const event of readSse(response)) {
    let value: Record<string, any>;
    try { value = JSON.parse(event.data) as Record<string, any>; } catch { continue; }
    if (event.event === "content_block_start" && value.content_block?.type === "tool_use") {
      const index = typeof value.index === "number" ? value.index : 0;
      toolIndexes.set(index, nextToolIndex);
      yield { id: "anthropic-stream", object: "chat.completion.chunk", choices: [{ index: 0, delta: { tool_calls: [{ index: nextToolIndex++, id: value.content_block.id, type: "function", function: { name: value.content_block.name, arguments: "" } }] }, finish_reason: null }] };
    } else if (event.event === "content_block_delta" && value.delta?.type === "text_delta") {
      yield { id: "anthropic-stream", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: value.delta.text ?? "" }, finish_reason: null }] };
    } else if (event.event === "content_block_delta" && value.delta?.type === "input_json_delta") {
      const index = typeof value.index === "number" ? value.index : 0;
      yield { id: "anthropic-stream", object: "chat.completion.chunk", choices: [{ index: 0, delta: { tool_calls: [{ index: toolIndexes.get(index) ?? 0, function: { arguments: value.delta.partial_json ?? "" } }] }, finish_reason: null }] };
    } else if (event.event === "message_delta") {
      yield { id: "anthropic-stream", object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: value.delta?.stop_reason ?? "stop" }] };
    }
  }
}

async function* geminiStream(response: Response): AsyncGenerator<Record<string, any>> {
  let index = 0;
  for await (const event of readSse(response)) {
    let value: Record<string, any>;
    try { value = JSON.parse(event.data) as Record<string, any>; } catch { continue; }
    const result = normalizedGeminiResult(value);
    const message = result.choices?.[0]?.message ?? {};
    const delta: Record<string, any> = {};
    if (message.content) delta.content = message.content;
    if (message.audio?.data) delta.audio = message.audio;
    if (message.tool_calls) {
      delta.tool_calls = message.tool_calls.map((call: Record<string, any>) => ({
        ...call,
        index: index++,
      }));
    }
    if (Object.keys(delta).length || value.candidates?.[0]?.finishReason) {
      yield {
        id: value.responseId ?? "gemini-stream",
        object: "chat.completion.chunk",
        choices: [{
          index: 0,
          delta,
          finish_reason: value.candidates?.[0]?.finishReason?.toLowerCase() ?? null,
        }],
      };
    }
  }
}

export async function invokeAssistantProvider(
  provider: ActiveAssistantProvider,
  model: AssistantProviderModel,
  request: ChatRequest,
  options?: { signal?: AbortSignal },
): Promise<Record<string, any> | AsyncIterable<Record<string, any>>> {
  assertProviderCapabilities(request, model, provider.providerName, provider.protocol);
  const stream = request.stream === true;
  let url: string;
  let body: Record<string, any>;
  let headers: Record<string, string>;
  if (provider.protocol === "anthropic-messages") {
    url = "https://api.anthropic.com/v1/messages";
    body = anthropicRequest(request, provider.modelId, stream);
    headers = { "x-api-key": provider.apiKey, "anthropic-version": "2023-06-01" };
  } else if (provider.protocol === "gemini-generate-content") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.modelId)}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
    body = geminiRequest(request, stream);
    headers = { "x-goog-api-key": provider.apiKey };
  } else if (provider.protocol === "openai-responses") {
    url = openAiEndpoint(provider, "responses");
    body = openAiResponsesRequest(request, provider.modelId, stream);
    headers = openAiHeaders(provider);
  } else {
    url = openAiEndpoint(provider, "chat/completions");
    body = openAiRequest(request, provider.modelId, stream);
    headers = openAiHeaders(provider);
  }
  const response = await postJson(url, provider, body, headers, options?.signal, stream);
  if (stream) {
    if (provider.protocol === "anthropic-messages") return anthropicStream(response);
    if (provider.protocol === "gemini-generate-content") return geminiStream(response);
    if (provider.protocol === "openai-responses") return responseStream(response);
    return (async function* () {
      for await (const event of readSse(response)) {
        if (event.data === "[DONE]") break;
        try { yield JSON.parse(event.data) as Record<string, any>; } catch {}
      }
    })();
  }
  const result = await readJson(response);
  if (provider.protocol === "anthropic-messages") return normalizedAnthropicResult(result);
  if (provider.protocol === "gemini-generate-content") return normalizedGeminiResult(result);
  if (provider.protocol === "openai-responses") return normalizedResponsesResult(result);
  return result;
}

export async function validateAssistantProviderConnection(
  provider: ActiveAssistantProvider,
  model: AssistantProviderModel,
): Promise<void> {
  const result = await invokeAssistantProvider(provider, model, {
    model: provider.modelId,
    messages: [{ role: "user", content: "Reply with OK." }],
    max_tokens: 8,
    max_completion_tokens: 8,
    temperature: 0,
  });
  if (!("choices" in result) || !Array.isArray(result.choices)) {
    throw new AssistantProviderRequestError(`${provider.providerName} returned an invalid test response.`, 502);
  }
}
