import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  chats: defineTable({
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
  }).index("by_chatId", ["chatId"]),

  messages: defineTable({
    messageId: v.string(),
    chatId: v.string(),
    backendId: v.string(),
    query: v.string(),
    createdAt: v.string(),
    responseBlocks: v.optional(v.any()),
    status: v.optional(v.string()),
  })
    .index("by_chatId", ["chatId"])
    .index("by_chatId_messageId", ["chatId", "messageId"]),
});
