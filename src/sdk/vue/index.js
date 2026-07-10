/**
 * LATIF Vue SDK
 */

import { provide, inject } from 'vue';

export const useLatifChat = () => inject('latif-chat');
export const useLatifModels = () => inject('latif-models');
export const useLatifAgent = () => inject('latif-agent');

export const LatifPlugin = {
  install(app, options) {
    const client = options.client;
    app.provide('latif-client', client);
  }
};
