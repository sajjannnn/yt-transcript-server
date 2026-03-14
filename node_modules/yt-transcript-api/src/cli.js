#!/usr/bin/env node

const { GenericProxyConfig, WebshareProxyConfig } = require('./proxies');
const { FormatterLoader } = require('./formatters');
const YouTubeTranscriptApi = require('./api');

class YouTubeTranscriptCli {
   constructor(args) {
      this._args = args;
   }

   async run() {
      const parsedArgs = this._parseArgs();

      if (parsedArgs.excludeManuallyCreated && parsedArgs.excludeGenerated) {
         throw new Error("You can't exclude both manually created and generated transcripts.");
      }

      let proxyConfig = null;
      if (parsedArgs.httpProxy || parsedArgs.httpsProxy) {
         proxyConfig = new GenericProxyConfig(
            parsedArgs.httpProxy || null,
            parsedArgs.httpsProxy || null
         );
      }

      if (
         parsedArgs.webshareProxyUsername !== null ||
         parsedArgs.webshareProxyPassword !== null
      ) {
         proxyConfig = new WebshareProxyConfig(
            parsedArgs.webshareProxyUsername,
            parsedArgs.webshareProxyPassword
         );
      }

      const transcripts = [];
      const exceptions = [];

      const yttApi = new YouTubeTranscriptApi({ proxyConfig });

      for (const videoId of parsedArgs.videoIds) {
         try {
            const transcriptList = await yttApi.list(videoId);
            const transcript = await this._fetchTranscript(parsedArgs, transcriptList);
            transcripts.push(transcript);
         } catch (e) {
            exceptions.push(e);
         }
      }

      const printSections = exceptions.map(exception => exception.toString());
      if (transcripts.length > 0) {
         const formatter = FormatterLoader.load(parsedArgs.format);
         printSections.unshift(
            formatter.formatTranscripts(transcripts, { ...parsedArgs })
         );
      }

      return printSections.join('\n\n');
   }

   async _fetchTranscript(parsedArgs, transcriptList) {
      // This method should select and fetch the transcript based on parsedArgs
      // For demonstration, we'll just fetch the first available transcript
      const transcript = transcriptList.findTranscript(parsedArgs.languages);
      return await transcript.fetch(parsedArgs.preserveFormatting);
   }

   _parseArgs() {
      // This is a placeholder for argument parsing logic.
      // In a real CLI, you would use a library like yargs or commander.
      // Here, we just provide a mock for demonstration.
      // Example: node cli.js --video-ids=abc123,def456 --format=json

      const args = require('minimist')(this._args);

      return {
         videoIds: this._sanitizeVideoIds(args),
         format: args.format || 'pretty',
         languages: args.languages ? args.languages.split(',') : ['en'],
         excludeManuallyCreated: !!args.excludeManuallyCreated,
         excludeGenerated: !!args.excludeGenerated,
         httpProxy: args.httpProxy || "",
         httpsProxy: args.httpsProxy || "",
         webshareProxyUsername: args.webshareProxyUsername || null,
         webshareProxyPassword: args.webshareProxyPassword || null,
         preserveFormatting: !!args.preserveFormatting,
      };
   }

   _sanitizeVideoIds(args) {
      // Accepts --video-ids=abc,def or positional arguments
      if (args['video-ids']) {
         return args['video-ids'].split(',').map(id => id.trim());
      }
      // Fallback: treat all non-flag arguments as video IDs
      return args._.filter(arg => typeof arg === 'string' && !arg.startsWith('--'));
   }
}
if (require.main === module) {
   (async () => {
      try {
         const cli = new YouTubeTranscriptCli(process.argv.slice(2));
         const output = await cli.run();
         console.log(output);
      } catch (err) {
         console.error(err);
         process.exit(1);
      }
   })();
} else {
   module.exports = YouTubeTranscriptCli;
}