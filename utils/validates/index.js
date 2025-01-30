const { validateAction, validateActionObject } = require("./action");
const validateQuickReply = require("./quickReply");
const validateUrl = require("./url");
const validateImageUrl = require("./imageUrl");
const validateStringParam = require("./stringParam");

module.exports = {
  validateAction,
  validateActionObject,
  validateQuickReply,
  validateUrl,
  validateImageUrl,
  validateStringParam,
};
