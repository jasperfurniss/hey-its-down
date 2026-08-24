export function createMemoryPersistence() {
  const monitors = new Map();
  const accounts = new Map();
  return {
    async getMonitor(id) {
      return monitors.get(id) ?? null;
    },
    async setMonitor(monitor) {
      monitors.set(monitor.id, monitor);
    },
    async listMonitors() {
      return [...monitors.values()];
    },
    async getAccount(email) {
      return accounts.get(email) ?? null;
    },
    async setAccount(account) {
      accounts.set(account.email, account);
    },
  };
}
