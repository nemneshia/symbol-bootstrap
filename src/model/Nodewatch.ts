export interface NodewatchPeer {
  balance: number;
  endpoint: string;
  finalizedEpoch: number;
  finalizedHash: string;
  finalizedHeight: number;
  finalizedPoint: number;
  geoLocation: NodewatchGeoLocation;
  height: number;
  isHealthy: boolean;
  isSslEnabled: boolean;
  mainPublicKey: string;
  name: string;
  nodePublicKey: string;
  restVersion: string;
  roles: number;
  version: string;
  host?: string;
  port?: number;
}

export interface NodewatchGeoLocation {
  city: string;
  continent: string;
  country: string;
  isp: string;
  lat: number;
  lon: number;
  region: string;
}
