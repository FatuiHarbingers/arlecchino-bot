import { ScheduledTask, type ScheduledTaskOptions } from '@sapphire/plugin-scheduled-tasks'
import { ActivityType } from 'discord.js'
import { ApplyOptions  } from '@sapphire/decorators'
import { Time } from '@sapphire/duration'

@ApplyOptions<ScheduledTaskOptions>( {
	enabled: true,
	interval: Time.Minute * 5,
	name: 'presence'
} )
export class UserTask extends ScheduledTask {
	public override async run(): Promise<void> {
		const wikiCount = await this.container.prisma.configuration.count()
		this.container.client.user?.setPresence( {
			activities: [ {
				name: `${ wikiCount } wikis | v${ process.env.npm_package_version ?? '1.0.0' }`,
				type: ActivityType.Watching
			} ]
		} )
	}
}

declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		presence: never
	}
}
