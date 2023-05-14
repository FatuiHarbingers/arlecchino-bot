import { Listener, type ListenerOptions } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events } from 'discord.js'

@ApplyOptions<ListenerOptions>( {
	event: Events.ClientReady,
	once: true
} )
export class UserEvent extends Listener {
	public run(): void {
		this.container.pino.info( 'Client is ready and running.' )

		this.container.tasks.create( 'presence', null, 0 )
		this.container.stores.get( 'scheduled-tasks' ).get( 'summary' )
			?.run( null )
	}
}
