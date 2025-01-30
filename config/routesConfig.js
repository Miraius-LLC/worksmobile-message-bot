module.exports = [
  // コンテンツ
  {
    path: "attachments",
    module: "./routes/attachments/upload",
  },
  // {
  //   path: "attachments",
  //   module: "./routes/attachments/download",
  // },

  // トークルーム指定
  {
    path: "channels/:channelId/messages/type/text",
    module: "./routes/channels/messages/text",
  },
  {
    path: "channels/:channelId/messages/type/sticker",
    module: "./routes/channels/messages/sticker",
  },
  {
    path: "channels/:channelId/messages/type/image",
    module: "./routes/channels/messages/image",
  },
  {
    path: "channels/:channelId/messages/type/file",
    module: "./routes/channels/messages/file",
  },
  {
    path: "channels/:channelId/messages/type/link",
    module: "./routes/channels/messages/link",
  },
  {
    path: "channels/:channelId/messages/type/button_template",
    module: "./routes/channels/messages/buttonTemplate",
  },
  {
    path: "channels/:channelId/messages/type/list_template",
    module: "./routes/channels/messages/listTemplate",
  },
  {
    path: "channels/:channelId/messages/type/carousel",
    module: "./routes/channels/messages/carousel",
  },
  {
    path: "channels/:channelId/messages/type/image_carousel",
    module: "./routes/channels/messages/imageCarousel",
  },
  {
    path: "channels/:channelId/messages/type/flex",
    module: "./routes/channels/messages/flex",
  },

  // ユーザー指定（変更点）
  {
    path: "users/:userId/messages/type/text",
    module: "./routes/users/messages/text",
  },
  {
    path: "users/:userId/messages/type/sticker",
    module: "./routes/users/messages/sticker",
  },
  {
    path: "users/:userId/messages/type/image",
    module: "./routes/users/messages/image",
  },
  {
    path: "users/:userId/messages/type/file",
    module: "./routes/users/messages/file",
  },
  {
    path: "users/:userId/messages/type/link",
    module: "./routes/users/messages/link",
  },
  {
    path: "users/:userId/messages/type/button_template",
    module: "./routes/users/messages/buttonTemplate",
  },
  {
    path: "users/:userId/messages/type/list_template",
    module: "./routes/users/messages/listTemplate",
  },
  {
    path: "users/:userId/messages/type/carousel",
    module: "./routes/users/messages/carousel",
  },
  {
    path: "users/:userId/messages/type/image_carousel",
    module: "./routes/users/messages/imageCarousel",
  },
  {
    path: "users/:userId/messages/type/flex",
    module: "./routes/users/messages/flex",
  },
];
