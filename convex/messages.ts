import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByChatId = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .collect();
  },
});

export const getByIds = query({
  args: { chatId: v.string(), messageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_chatId_messageId", (q) =>
        q.eq("chatId", args.chatId).eq("messageId", args.messageId)
      )
      .first();
  },
});

export const create = mutation({
  args: {
    messageId: v.string(),
    chatId: v.string(),
    backendId: v.string(),
    query: v.string(),
    createdAt: v.string(),
    responseBlocks: v.optional(v.any()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      messageId: args.messageId,
      chatId: args.chatId,
      backendId: args.backendId,
      query: args.query,
      createdAt: args.createdAt,
      responseBlocks: args.responseBlocks ?? [],
      status: args.status ?? "answering",
    });
  },
});

export const update = mutation({
  args: {
    chatId: v.string(),
    messageId: v.string(),
    status: v.optional(v.string()),
    responseBlocks: v.optional(v.any()),
    backendId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db
      .query("messages")
      .withIndex("by_chatId_messageId", (q) =>
        q.eq("chatId", args.chatId).eq("messageId", args.messageId)
      )
      .first();

    if (!msg) return;

    const patch: Record<string, any> = {};
    if (args.status !== undefined) patch.status = args.status;
    if (args.responseBlocks !== undefined)
      patch.responseBlocks = args.responseBlocks;
    if (args.backendId !== undefined) patch.backendId = args.backendId;

    await ctx.db.patch(msg._id, patch);
  },
});

export const deleteAfter = mutation({
  args: {
    chatId: v.string(),
    afterCreationTime: v.number(),
  },
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .collect();

    for (const msg of msgs) {
      if (msg._creationTime > args.afterCreationTime) {
        await ctx.db.delete(msg._id);
      }
    }
  },
});

export const deleteByChatId = mutation({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .collect();
    for (const msg of msgs) {
      await ctx.db.delete(msg._id);
    }
  },
});
