import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const chats = await ctx.db.query("chats").order("desc").collect();
    return chats;
  },
});

export const getById = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .first();
  },
});

export const create = mutation({
  args: {
    chatId: v.string(),
    title: v.string(),
    createdAt: v.string(),
    sources: v.optional(v.array(v.string())),
    files: v.optional(
      v.array(
        v.object({
          name: v.string(),
          fileId: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chats", {
      chatId: args.chatId,
      title: args.title,
      createdAt: args.createdAt,
      sources: args.sources ?? [],
      files: args.files ?? [],
    });
  },
});

export const deleteById = mutation({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    // Delete the chat
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .first();
    if (chat) {
      await ctx.db.delete(chat._id);
    }

    // Delete all messages in the chat
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
  },
});
