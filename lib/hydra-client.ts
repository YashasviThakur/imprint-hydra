// Single import point the rest of the app uses instead of lib/hydra.ts or
// lib/hydra-http.ts directly. Picks the transport by environment: local dev
// reaches HydraDB's Bolt port directly (localhost:7687, no tunnel needed);
// a Vercel deployment can't reach localhost, so it goes over the ngrok HTTP
// tunnel instead (set HYDRA_HTTP_URL to enable it). Same graph model, same
// query-engine constraints, same public interface either way.
import * as bolt from "./hydra";
import * as http from "./hydra-http";

const impl = process.env.HYDRA_HTTP_URL ? http : bolt;

export const ensureSession = impl.ensureSession;
export const saveMemory = impl.saveMemory;
export const linkEntity = impl.linkEntity;
export const linkSupersedes = impl.linkSupersedes;
export const getCurrentFactsAboutEntity = impl.getCurrentFactsAboutEntity;
export const getSupersedeChain = impl.getSupersedeChain;
export const getCurrentFactsForUser = impl.getCurrentFactsForUser;
export const getGraphStats = impl.getGraphStats;
export const getQueryStats = impl.getQueryStats;
export const resetQueryStats = impl.resetQueryStats;
export const closeHydraDriver = impl.closeHydraDriver;
export type HydraMemory = bolt.HydraMemory;
export type GraphStats = bolt.GraphStats;
export type QueryStats = bolt.QueryStats;
