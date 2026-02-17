import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const providers = await ctx.db.query("providers").collect();
    return providers;
  },
});

export const getById = query({
  args: { providerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("providers")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .first();
  },
});

export const getByHash = query({
  args: { hash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("providers")
      .withIndex("by_hash", (q) => q.eq("hash", args.hash))
      .first();
  },
});

export const create = mutation({
  args: {
    providerId: v.string(),
    name: v.string(),
    type: v.string(),
    config: v.any(),
    chatModels: v.array(
      v.object({
        name: v.string(),
        key: v.string(),
      })
    ),
    embeddingModels: v.array(
      v.object({
        name: v.string(),
        key: v.string(),
      })
    ),
    hash: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("providers", {
      providerId: args.providerId,
      name: args.name,
      type: args.type,
      config: args.config,
      chatModels: args.chatModels,
      embeddingModels: args.embeddingModels,
      hash: args.hash,
    });
  },
});

export const update = mutation({
  args: {
    providerId: v.string(),
    name: v.optional(v.string()),
    config: v.optional(v.any()),
    chatModels: v.optional(
      v.array(
        v.object({
          name: v.string(),
          key: v.string(),
        })
      )
    ),
    embeddingModels: v.optional(
      v.array(
        v.object({
          name: v.string(),
          key: v.string(),
        })
      )
    ),
    hash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const provider = await ctx.db
      .query("providers")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .first();

    if (!provider) {
      throw new Error("Provider not found");
    }

    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.config !== undefined) patch.config = args.config;
    if (args.chatModels !== undefined) patch.chatModels = args.chatModels;
    if (args.embeddingModels !== undefined)
      patch.embeddingModels = args.embeddingModels;
    if (args.hash !== undefined) patch.hash = args.hash;

    await ctx.db.patch(provider._id, patch);
    return { ...provider, ...patch };
  },
});

export const deleteById = mutation({
  args: { providerId: v.string() },
  handler: async (ctx, args) => {
    const provider = await ctx.db
      .query("providers")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .first();

    if (provider) {
      await ctx.db.delete(provider._id);
    }
  },
});

export const addModel = mutation({
  args: {
    providerId: v.string(),
    type: v.union(v.literal("chat"), v.literal("embedding")),
    model: v.object({
      name: v.string(),
      key: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const provider = await ctx.db
      .query("providers")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .first();

    if (!provider) {
      throw new Error("Provider not found");
    }

    if (args.type === "chat") {
      await ctx.db.patch(provider._id, {
        chatModels: [...provider.chatModels, args.model],
      });
    } else {
      await ctx.db.patch(provider._id, {
        embeddingModels: [...provider.embeddingModels, args.model],
      });
    }

    return args.model;
  },
});

export const removeModel = mutation({
  args: {
    providerId: v.string(),
    type: v.union(v.literal("chat"), v.literal("embedding")),
    modelKey: v.string(),
  },
  handler: async (ctx, args) => {
    const provider = await ctx.db
      .query("providers")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .first();

    if (!provider) {
      throw new Error("Provider not found");
    }

    if (args.type === "chat") {
      await ctx.db.patch(provider._id, {
        chatModels: provider.chatModels.filter((m) => m.key !== args.modelKey),
      });
    } else {
      await ctx.db.patch(provider._id, {
        embeddingModels: provider.embeddingModels.filter(
          (m) => m.key !== args.modelKey
        ),
      });
    }
  },
});