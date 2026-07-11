import type { IRulePlugin } from '../types/index.js'

export class PluginLoader {
  private plugins = new Map<string, IRulePlugin>()

  register(plugin: IRulePlugin): void {
    plugin.initialize()
    this.plugins.set(plugin.metadata.id, plugin)
  }

  registerAll(plugins: IRulePlugin[]): void {
    for (const p of plugins) this.register(p)
  }

  get(id: string): IRulePlugin | undefined {
    return this.plugins.get(id)
  }

  getAll(): IRulePlugin[] {
    return [...this.plugins.values()]
  }

  getByNames(names?: string[]): IRulePlugin[] {
    const all = this.getAll()
    if (!names?.length) return all
    return all.filter((p) =>
      names.some((n) => p.metadata.id === n || p.metadata.name.toLowerCase() === n.toLowerCase()),
    )
  }

  discover(plugins: IRulePlugin[]): IRulePlugin[] {
    this.registerAll(plugins)
    return this.getAll()
  }

  count(): number {
    return this.plugins.size
  }
}
