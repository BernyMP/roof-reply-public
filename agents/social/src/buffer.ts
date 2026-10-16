import type { SocialPlatform } from "./social-content.ts";

export type BufferPost = {
  id: string;
  text: string;
  channelId: string;
  status: string;
  dueAt: string | null;
  externalLink?: string | null;
};
export type BufferChannel = {
  id: string;
  name: string;
  service: string;
  type: string;
  organizationId: string;
  isDisconnected: boolean;
  isLocked: boolean;
  isQueuePaused: boolean;
  metadata?: { defaultToReminders?: boolean } | null;
};
export class BufferRequestError extends Error {
  uncertain: boolean;
  constructor(message: string, uncertain = false) {
    super(message);
    this.name = "BufferRequestError";
    this.uncertain = uncertain;
  }
}
const POST_FIELDS = "id text channelId status dueAt externalLink";

export class BufferClient {
  private key: string;
  private fetcher: typeof fetch;
  constructor(key = process.env.BUFFER_API_KEY || "", fetcher = fetch) {
    this.key = key;
    this.fetcher = fetcher;
  }
  async request<T>(
    query: string,
    variables: object,
    mutation = false,
  ): Promise<T> {
    if (!this.key)
      throw new BufferRequestError(
        "BUFFER_API_KEY is missing in the Convex environment.",
      );
    let response: Response;
    try {
      response = await this.fetcher("https://api.buffer.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.key}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new BufferRequestError(
        "Buffer response was not received; reconcile before retrying.",
        mutation,
      );
    }
    if (!response.ok)
      throw new BufferRequestError(
        `Buffer request failed (HTTP ${response.status}).`,
        mutation && ![400, 401, 403, 429].includes(response.status),
      );
    let body;
    try {
      body = await response.json();
    } catch {
      throw new BufferRequestError(
        "Buffer returned an unreadable response.",
        mutation,
      );
    }
    if (body.errors?.length || !body.data)
      throw new BufferRequestError(
        "Buffer could not confirm the operation. Check API permissions and schema.",
        mutation,
      );
    return body.data as T;
  }
  async channels(organizationId: string): Promise<BufferChannel[]> {
    const data = await this.request<{ channels: BufferChannel[] }>(
      `query Channels($input: ChannelsInput!) {
      channels(input: $input) { id name service type organizationId isDisconnected isLocked isQueuePaused metadata { ... on InstagramMetadata { defaultToReminders } } }
    }`,
      { input: { organizationId } },
    );
    return data.channels;
  }
  async create(
    platform: SocialPlatform,
    channelId: string,
    text: string,
    imageUrl: string,
    dueAt: number,
  ): Promise<BufferPost> {
    const data = await this.request<{
      createPost: { post?: BufferPost; __typename: string; message?: string };
    }>(
      `mutation Schedule($input: CreatePostInput!) {
      createPost(input: $input) { __typename ... on PostActionSuccess { post { ${POST_FIELDS} } } ... on MutationError { message } }
    }`,
      {
        input: {
          channelId,
          text,
          dueAt: new Date(dueAt).toISOString(),
          schedulingType: "automatic",
          mode: "customScheduled",
          aiAssisted: true,
          assets: [{ image: { url: imageUrl } }],
          metadata:
            platform === "instagram"
              ? { instagram: { type: "post", shouldShareToFeed: true } }
              : { facebook: { type: "post" } },
        },
      },
      true,
    );
    if (!data.createPost?.post?.id) {
      const rejected = Boolean(
        data.createPost?.message &&
        data.createPost.__typename &&
        data.createPost.__typename !== "PostActionSuccess",
      );
      throw new BufferRequestError(
        "Buffer did not confirm the scheduled post.",
        !rejected,
      );
    }
    return data.createPost.post;
  }
  async get(id: string): Promise<BufferPost> {
    const data = await this.request<{ post: BufferPost }>(
      `query Post($input: PostInput!) { post(input: $input) { ${POST_FIELDS} } }`,
      { input: { id } },
    );
    return data.post;
  }
  async metrics(id: string) {
    const data = await this.request<{ post: { metrics: { type: string; name: string; value: number | null; unit: string }[] | null; metricsUpdatedAt?: string | null } }>(
      `query Metrics($input: PostInput!) { post(input: $input) { metrics { type name value unit } metricsUpdatedAt } }`, { input: { id } },
    );
    return data.post;
  }
  async find(
    organizationId: string,
    channelId: string,
    text: string,
    dueAt: number,
  ): Promise<BufferPost[]> {
    const found: BufferPost[] = [];
    let after: string | null = null;
    // Bound pagination: an incomplete reconciliation must never authorize creation.
    for (let page = 0; page < 10; page++) {
      const data: {
        posts: {
          edges: { node: BufferPost }[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      } = await this.request(
        `query Find($input: PostsInput!, $after: String) {
        posts(input: $input, first: 100, after: $after) { edges { node { ${POST_FIELDS} } } pageInfo { hasNextPage endCursor } }
      }`,
        {
          input: {
            organizationId,
            filter: {
              channelIds: [channelId],
              dueAt: {
                start: new Date(dueAt - 60_000).toISOString(),
                end: new Date(dueAt + 60_000).toISOString(),
              },
            },
          },
          after,
        },
      );
      found.push(
        ...data.posts.edges
          .map((edge) => edge.node)
          .filter(
            (post) =>
              post.channelId === channelId &&
              post.text === text &&
              Date.parse(post.dueAt || "") === dueAt,
          ),
      );
      if (!data.posts.pageInfo.hasNextPage) return found;
      after = data.posts.pageInfo.endCursor;
      if (!after) break;
    }
    throw new BufferRequestError(
      "Buffer reconciliation is incomplete; manual inspection required.",
    );
  }
  async cancel(id: string): Promise<void> {
    const data = await this.request<{
      deletePost: { __typename: string; id?: string };
    }>(
      `mutation Cancel($input: DeletePostInput!) {
      deletePost(input: $input) { __typename ... on DeletePostSuccess { id } ... on MutationError { message } }
    }`,
      { input: { id } },
      true,
    );
    if (
      data.deletePost?.__typename !== "DeletePostSuccess" ||
      data.deletePost.id !== id
    )
      throw new BufferRequestError(
        "Buffer did not confirm cancellation.",
        true,
      );
  }
}

export function verifyChannels(
  channels: BufferChannel[],
  config: {
    organizationId: string;
    facebookChannelId: string;
    instagramChannelId: string;
  },
) {
  for (const platform of ["facebook", "instagram"] as const) {
    const channel = channels.find(
      (c) => c.id === config[`${platform}ChannelId`],
    );
    if (
      !channel ||
      channel.organizationId !== config.organizationId ||
      channel.service !== platform
    )
      throw new Error(`Verify the selected ${platform} account in Buffer.`);
    if (channel.isDisconnected || channel.isLocked || channel.isQueuePaused)
      throw new Error(
        `The ${platform} channel is disconnected, locked, or paused.`,
      );
    if (platform === "facebook" && channel.type !== "page")
      throw new Error("Facebook publishing requires a Page.");
    if (
      platform === "instagram" &&
      (!["business", "creator"].includes(channel.type) ||
        channel.metadata?.defaultToReminders !== false)
    )
      throw new Error(
        "Instagram must be a professional account with automatic publishing enabled.",
      );
  }
}
