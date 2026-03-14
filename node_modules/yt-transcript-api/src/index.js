#!/usr/bin/env node
const YouTubeTranscriptApi = require('./api');
const YouTubeTranscriptCli = require('./cli');
const TranscriptListFetcher = require('./transcripts').TranscriptListFetcher;
const ProxyConfig = require('./proxies').ProxyConfig;
const GenericProxyConfig = require('./proxies').GenericProxyConfig;
const WebshareProxyConfig = require('./proxies').WebshareProxyConfig;
const InvalidProxyConfig = require('./proxies').InvalidProxyConfig;
const formatters = require('./formatters');
const errors = require('./errors');
const settings = require('./settings');

async function main() {
   try {
      const result = await new YouTubeTranscriptCli(process.argv.slice(2)).run();
      console.log(result);
   } catch (err) {
      console.error(err);
      process.exit(1);
   }
}

if (require.main === module) {
   main();
}

module.exports = {
   YouTubeTranscriptApi,
   YouTubeTranscriptCli,
   TranscriptListFetcher,
   ProxyConfig,
   GenericProxyConfig,
   WebshareProxyConfig,
   InvalidProxyConfig,
   formatters,
   errors,
   settings
};