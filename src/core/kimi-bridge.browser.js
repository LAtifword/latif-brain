export async function initKimiLayer() {
  return null;
}

export async function checkKimiHealth() {
  return { available: false, reason: 'Kimi integration is available only in the Node runtime.' };
}

export async function shutdownKimiLayer() {
  return undefined;
}
