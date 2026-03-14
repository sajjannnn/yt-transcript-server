const util = require('util');

class Formatter {
   // Abstract base class
   formatTranscript(transcript, options = {}) {
      throw new Error("A subclass of Formatter must implement their own .formatTranscript() method.");
   }

   formatTranscripts(transcripts, options = {}) {
      throw new Error("A subclass of Formatter must implement their own .formatTranscripts() method.");
   }
}

class PrettyPrintFormatter extends Formatter {
   formatTranscript(transcript, options = {}) {
      return util.inspect(transcript.toRawData(), { depth: null, ...options });
   }

   formatTranscripts(transcripts, options = {}) {
      return util.inspect(transcripts.map(t => t.toRawData()), { depth: null, ...options });
   }
}

class JSONFormatter extends Formatter {
   formatTranscript(transcript, options = {}) {
      return JSON.stringify(transcript.toRawData(), null, options.space || 0);
   }

   formatTranscripts(transcripts, options = {}) {
      return JSON.stringify(transcripts.map(t => t.toRawData()), null, options.space || 0);
   }
}

class TextFormatter extends Formatter {
   formatTranscript(transcript, options = {}) {
      // transcript is expected to be an array-like of objects with a .text property
      return transcript.map(line => line.text).join('\n');
   }

   formatTranscripts(transcripts, options = {}) {
      return transcripts.map(t => this.formatTranscript(t, options)).join('\n\n\n');
   }
}

class _TextBasedFormatter extends TextFormatter {
   _formatTimestamp(hours, mins, secs, ms) {
      throw new Error("A subclass of _TextBasedFormatter must implement their own ._formatTimestamp() method.");
   }

   _formatTranscriptHeader(lines) {
      throw new Error("A subclass of _TextBasedFormatter must implement their own ._formatTranscriptHeader() method.");
   }

   _formatTranscriptHelper(i, timeText, snippet) {
      throw new Error("A subclass of _TextBasedFormatter must implement their own ._formatTranscriptHelper() method.");
   }

   _secondsToTimestamp(time) {
      time = parseFloat(time);
      const hours = Math.floor(time / 3600);
      const mins = Math.floor((time % 3600) / 60);
      const secs = Math.floor(time % 60);
      const ms = Math.round((time - Math.floor(time)) * 1000);
      return this._formatTimestamp(hours, mins, secs, ms);
   }

   formatTranscript(transcript, options = {}) {
      const lines = [];
      for (let i = 0; i < transcript.length; i++) {
         const line = transcript[i];
         const end = line.start + line.duration;
         const nextStart = (i < transcript.length - 1 && transcript[i + 1].start < end)
            ? transcript[i + 1].start
            : end;
         const timeText = `${this._secondsToTimestamp(line.start)} --> ${this._secondsToTimestamp(nextStart)}`;
         lines.push(this._formatTranscriptHelper(i, timeText, line));
      }
      return this._formatTranscriptHeader(lines);
   }
}

class SRTFormatter extends _TextBasedFormatter {
   _formatTimestamp(hours, mins, secs, ms) {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
   }

   _formatTranscriptHeader(lines) {
      return lines.join('\n\n') + '\n';
   }

   _formatTranscriptHelper(i, timeText, snippet) {
      return `${i + 1}\n${timeText}\n${snippet.text}`;
   }
}

class WebVTTFormatter extends _TextBasedFormatter {
   _formatTimestamp(hours, mins, secs, ms) {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
   }

   _formatTranscriptHeader(lines) {
      return 'WEBVTT\n\n' + lines.join('\n\n') + '\n';
   }

   _formatTranscriptHelper(i, timeText, snippet) {
      return `${timeText}\n${snippet.text}`;
   }
}

class FormatterLoader {
   static TYPES = {
      json: JSONFormatter,
      pretty: PrettyPrintFormatter,
      text: TextFormatter,
      webvtt: WebVTTFormatter,
      srt: SRTFormatter,
   };

   static UnknownFormatterType = class extends Error {
      constructor(formatterType) {
         super(
            `The format '${formatterType}' is not supported. `
            + `Choose one of the following formats: ${Object.keys(FormatterLoader.TYPES).join(', ')}`
         );
      }
   };

   static load(formatterType = 'pretty') {
      if (!(formatterType in FormatterLoader.TYPES)) {
         throw new FormatterLoader.UnknownFormatterType(formatterType);
      }
      return new FormatterLoader.TYPES[formatterType]();
   }
}

module.exports = {
   Formatter,
   PrettyPrintFormatter,
   JSONFormatter,
   TextFormatter,
   SRTFormatter,
   WebVTTFormatter,
   FormatterLoader
};