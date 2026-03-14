class InvalidProxyConfig extends Error { }

class ProxyConfig {
   // Abstract base class for proxy configs
   toRequestsDict() {
      throw new Error("A subclass of ProxyConfig must implement toRequestsDict()");
   }
}

class GenericProxyConfig extends ProxyConfig {
   constructor(httpUrl = null, httpsUrl = null) {
      super();
      if (!httpUrl && !httpsUrl) {
         throw new InvalidProxyConfig(
            "GenericProxyConfig requires you to define at least one of the two: http or https"
         );
      }
      this.httpUrl = httpUrl;
      this.httpsUrl = httpsUrl;
   }

   toRequestsDict() {
      return {
         http: this.httpUrl || this.httpsUrl,
         https: this.httpsUrl || this.httpUrl,
      };
   }
}

class WebshareProxyConfig extends GenericProxyConfig {
   static DEFAULT_DOMAIN_NAME = "p.webshare.io";
   static DEFAULT_PORT = 80;

   constructor(
      proxyUsername,
      proxyPassword,
      retriesWhenBlocked = 10,
      domainName = WebshareProxyConfig.DEFAULT_DOMAIN_NAME,
      proxyPort = WebshareProxyConfig.DEFAULT_PORT
   ) {
      // Build the proxy URL for Webshare rotating residential proxies
      const url = `http://${proxyUsername}:${proxyPassword}@${domainName}:${proxyPort}`;
      super(url, url);
      this.proxyUsername = proxyUsername;
      this.proxyPassword = proxyPassword;
      this.domainName = domainName;
      this.proxyPort = proxyPort;
      this.retriesWhenBlocked = retriesWhenBlocked;
   }
}

module.exports = {
   InvalidProxyConfig,
   ProxyConfig,
   GenericProxyConfig,
   WebshareProxyConfig
};