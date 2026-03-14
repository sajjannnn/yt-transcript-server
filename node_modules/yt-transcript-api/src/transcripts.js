const { WATCH_URL, INNERTUBE_CONTEXT, INNERTUBE_API_URL } = require('./settings');
const {
   VideoUnavailable,
   YouTubeRequestFailed,
   NoTranscriptFound,
   TranscriptsDisabled,
   NotTranslatable,
   TranslationLanguageNotAvailable,
   FailedToCreateConsentCookie,
   InvalidVideoId,
   IpBlocked,
   RequestBlocked,
   AgeRestricted,
   VideoUnplayable,
   YouTubeDataUnparsable,
   PoTokenRequired
} = require('./errors');
const { XMLParser } = require('fast-xml-parser');
const he = require('he');
const axios = require('axios');
class FetchedTranscriptSnippet {
   constructor({ text, start, duration }) {
      this.text = text;
      this.start = start;
      this.duration = duration;
   }
}

class FetchedTranscript extends Array {
   constructor(snippets, videoId, language, languageCode, isGenerated = false) {
      super(...(Array.isArray(snippets) ? snippets : []));
      this.videoId = videoId;
      this.language = language;
      this.languageCode = languageCode;
      this.isGenerated = isGenerated;
   }

   toRawData() {
      return this.map(snippet => ({
         text: snippet.text,
         start: snippet.start,
         duration: snippet.duration
      }));
   }
}

class Transcript {
   constructor(httpClient, videoId, url, language, languageCode, isGenerated, translationLanguages) {
      this._httpClient = httpClient || axios.create();
      this._httpClient.defaults.headers['Accept-Language'] = 'en-US';
      this.videoId = videoId;
      this._url = url;
      this.language = language;
      this.languageCode = languageCode;
      this.isGenerated = isGenerated;
      this.translationLanguages = translationLanguages;
      this._translationLanguagesDict = {};
      for (const t of translationLanguages) {
         this._translationLanguagesDict[t.language_code] = t.language;
      }
   }

   async fetch(preserveFormatting = false) {
      if (this._url.includes("&exp=xpe")) {
         throw new PoTokenRequired(this.videoId);
      }
      const response = await this._httpClient.get(this._url);
      _raiseHttpErrors(response, this.videoId);
      const parser = new _TranscriptParser(preserveFormatting);
      const snippets = parser.parse(response.data);
      return new FetchedTranscript(
         snippets,
         this.videoId,
         this.language,
         this.languageCode,
         this.isGenerated
      );
   }

   toString() {
      return `${this.languageCode} ("${this.language}")${this.isTranslatable ? "[TRANSLATABLE]" : ""}`;
   }

   get isTranslatable() {
      return this.translationLanguages && this.translationLanguages.length > 0;
   }

   translate(languageCode) {
      if (!this.isTranslatable) throw new NotTranslatable(this.videoId);
      if (!(languageCode in this._translationLanguagesDict)) throw new TranslationLanguageNotAvailable(this.videoId);
      return new Transcript(
         this._httpClient,
         this.videoId,
         `${this._url}&tlang=${languageCode}`,
         this._translationLanguagesDict[languageCode],
         languageCode,
         true,
         []
      );
   }
}

class TranscriptList {
   constructor(videoId, manuallyCreatedTranscripts, generatedTranscripts, translationLanguages) {
      this.videoId = videoId;
      this._manuallyCreatedTranscripts = manuallyCreatedTranscripts;
      this._generatedTranscripts = generatedTranscripts;
      this._translationLanguages = translationLanguages;
   }

   static build(httpClient, videoId, captionsJson) {
      const translationLanguages = (captionsJson.translationLanguages || []).map(tl => ({
         language: tl.languageName.runs[0].text,
         language_code: tl.languageCode
      }));

      const manuallyCreatedTranscripts = {};
      const generatedTranscripts = {};

      for (const caption of captionsJson.captionTracks) {
         const transcriptDict = (caption.kind === "asr") ? generatedTranscripts : manuallyCreatedTranscripts;
         transcriptDict[caption.languageCode] = new Transcript(
            httpClient,
            videoId,
            caption.baseUrl.replace("&fmt=srv3", ""),
            caption.name.runs[0].text,
            caption.languageCode,
            caption.kind === "asr",
            caption.isTranslatable ? translationLanguages : []
         );
      }

      return new TranscriptList(
         videoId,
         manuallyCreatedTranscripts,
         generatedTranscripts,
         translationLanguages
      );
   }

   [Symbol.iterator]() {
      // Iterate over all transcripts
      return [...Object.values(this._manuallyCreatedTranscripts), ...Object.values(this._generatedTranscripts)][Symbol.iterator]();
   }

   findTranscript(languageCodes) {
      return this._findTranscript(languageCodes, [this._manuallyCreatedTranscripts, this._generatedTranscripts]);
   }

   findGeneratedTranscript(languageCodes) {
      return this._findTranscript(languageCodes, [this._generatedTranscripts]);
   }

   findManuallyCreatedTranscript(languageCodes) {
      return this._findTranscript(languageCodes, [this._manuallyCreatedTranscripts]);
   }

   _findTranscript(languageCodes, transcriptDicts) {
      for (const code of languageCodes) {
         for (const dict of transcriptDicts) {
            if (code in dict) return dict[code];
         }
      }
      throw new NoTranscriptFound(this.videoId, languageCodes, this);
   }

   toString() {
      const getLangDesc = (transcriptStrings) => {
         const arr = Array.from(transcriptStrings);
         return arr.length ? arr.map(t => ` - ${t}`).join('\n') : "None";
      };
      return (
         `For this video (${this.videoId}) transcripts are available in the following languages:\n\n` +
         `(MANUALLY CREATED)\n${getLangDesc(Object.values(this._manuallyCreatedTranscripts).map(t => t.toString()))}\n\n` +
         `(GENERATED)\n${getLangDesc(Object.values(this._generatedTranscripts).map(t => t.toString()))}\n\n` +
         `(TRANSLATION LANGUAGES)\n${getLangDesc(this._translationLanguages.map(tl => `${tl.language_code} ("${tl.language}")`))}`
      );
   }
}

class TranscriptListFetcher {
   constructor(httpClient = null, proxyConfig = null) {
      // Use axios for HTTP requests
      this._httpClient = httpClient || axios.create();
      this._httpClient.defaults.headers['Accept-Language'] = 'en-US';

      // Proxy support (basic, for demonstration)
      if (proxyConfig) {
         // You may need to use a proxy agent for axios in real usage
         // This is a placeholder for proxy config
         this.proxyConfig = proxyConfig;
      } else {
         this.proxyConfig = null;
      }
   }

   async fetch(videoId) {
      const captionsJson = await this._fetchCaptionsJson(videoId, 0);
      return TranscriptList.build(this._httpClient, videoId, captionsJson);
   }

   async _fetchCaptionsJson(videoId, tryNumber = 0) {
      try {
         const html = await this._fetchVideoHtml(videoId);
         const apiKey = this._extractInnertubeApiKey(html, videoId);
         const innertubeData = await this._fetchInnertubeData(videoId, apiKey);
         return this._extractCaptionsJson(innertubeData, videoId);
      } catch (exception) {
         if (exception instanceof RequestBlocked) {
            const retries = this._proxyConfig ? this._proxyConfig.retriesWhenBlocked : 0;
            if (tryNumber + 1 < retries) {
               return this._fetchCaptionsJson(videoId, tryNumber + 1);
            }
            throw exception.withProxyConfig(this._proxyConfig);
         }
         throw exception;
      }
   }

   _extractInnertubeApiKey(html, videoId) {
      const match = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
      if (match && match[1]) return match[1];
      if (html.includes('class="g-recaptcha"')) throw new IpBlocked(videoId);
      throw new YouTubeDataUnparsable(videoId);
   }

   _extractCaptionsJson(innertubeData, videoId) {
      this._assertPlayability(innertubeData.playabilityStatus, videoId);
      const captionsJson = innertubeData.captions?.playerCaptionsTracklistRenderer;
      if (!captionsJson || !captionsJson.captionTracks) throw new TranscriptsDisabled(videoId);
      return captionsJson;
   }

   _assertPlayability(playabilityStatusData, videoId) {
      const status = playabilityStatusData?.status;
      const reason = playabilityStatusData?.reason;
      if (status && status !== "OK") {
         if (status === "LOGIN_REQUIRED") {
            if (reason === "Sign in to confirm you’re not a bot") throw new RequestBlocked(videoId);
            if (reason === "This video may be inappropriate for some users.") throw new AgeRestricted(videoId);
         }
         if (status === "ERROR" && reason === "This video is unavailable") {
            if (videoId.startsWith("http://") || videoId.startsWith("https://")) throw new InvalidVideoId(videoId);
            throw new VideoUnavailable(videoId);
         }
         const subreasons = playabilityStatusData?.errorScreen?.playerErrorMessageRenderer?.subreason?.runs || [];
         throw new VideoUnplayable(videoId, reason, subreasons.map(run => run.text || ""));
      }
   }

   async _fetchVideoHtml(videoId) {
      let html = await this._fetchHtml(videoId);
      if (html.includes('action="https://consent.youtube.com/s"')) {
         await this._createConsentCookie(html, videoId);
         html = await this._fetchHtml(videoId);
         if (html.includes('action="https://consent.youtube.com/s"')) throw new FailedToCreateConsentCookie(videoId);
      }
      return html;
   }

   async _fetchHtml(videoId) {
      const url = WATCH_URL.replace('{video_id}', videoId);
      const response = await this._httpClient.get(url);
      _raiseHttpErrors(response, videoId);
      // Use he.decode to unescape HTML entities
      return he.decode(response.data);
   }

   async _createConsentCookie(html, videoId) {
      const match = html.match(/name="v" value="(.*?)"/);
      if (!match) throw new FailedToCreateConsentCookie(videoId);
      // This is a placeholder. In a real implementation, set the cookie on the httpClient.
      // Example: this._httpClient.defaults.headers.Cookie = `CONSENT=YES+${match[1]}; domain=.youtube.com;`;
   }

   async _fetchInnertubeData(videoId, apiKey) {
      const url = INNERTUBE_API_URL.replace('{api_key}', apiKey);
      const response = await this._httpClient.post(url, {
         context: INNERTUBE_CONTEXT,
         videoId: videoId
      });
      _raiseHttpErrors(response, videoId);
      return response.data;
   }
}

function _raiseHttpErrors(response, videoId) {
   if (response.status && response.status >= 400) {
      throw new YouTubeRequestFailed(videoId, response.statusText || response.status);
   }
   return response;
}

class _TranscriptParser {
   constructor(preserveFormatting = false) {
      this._FORMATTING_TAGS = [
         "strong", "em", "b", "i", "mark", "small", "del", "ins", "sub", "sup"
      ];
      this._htmlRegex = this._getHtmlRegex(preserveFormatting);
   }

   _getHtmlRegex(preserveFormatting) {
      if (preserveFormatting) {
         const tags = this._FORMATTING_TAGS.join('|');
         return new RegExp(`<\\/?(?!(${tags})\\b)[^>]*>`, 'gi');
      }
      return /<[^>]*>/gi;
   }

   parse(rawData) {
      const parser = new XMLParser({
         ignoreAttributes: false,
         attributeNamePrefix: '',
      });
      const parsed = parser.parse(rawData);
      let texts = [];
      if (parsed.transcript && parsed.transcript.text) {
         texts = parsed.transcript.text;
      }

      // Ensure texts is always an array
      const textArray = Array.isArray(texts) ? texts : [texts];

      // Map to FetchedTranscriptSnippet objects
      return textArray
         .filter(t => t && typeof t === 'object')
         .map(t => {
            let text = t['#text'] || t.text || '';
            text = he.decode(text);
            text = text.replace(this._htmlRegex, '');
            return new FetchedTranscriptSnippet({
               text: text,
               start: parseFloat(t.start),
               duration: parseFloat(t.dur || "0.0")
            });
         });
   }
}

module.exports = {
   FetchedTranscriptSnippet,
   FetchedTranscript,
   Transcript,
   TranscriptList,
   TranscriptListFetcher
};