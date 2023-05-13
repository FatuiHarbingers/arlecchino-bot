import { LogLevel } from '@sapphire/framework'
import { Lumberjack } from '@bitomic/lumberjack-client'
import { pino } from './pino'

type Log = Parameters<Lumberjack[ 'debug' ]>[ 0 ]

export class Logger {
	public readonly lumberjack = new Lumberjack( 'arlecchino', 'lumberjack', 1337 )
	public readonly pino = pino

	public has( level: LogLevel ): boolean {
		return level in this.lumberjack
	}

	protected log( log: Log | string | Record<string, unknown>, level: 'debug' | 'error' | 'info' | 'warn' ): void {
		if ( typeof log === 'string' ) {
			log = { message: log }
		} else if ( !( 'message' in log ) && !( 'data' in log ) ) {
			log = { data: log }
		}

		this.pino[ level ]( log )
		this.lumberjack[ level ]( log )
	}

	public trace( log: Log | string ): void {
		this.log( log, 'debug' )
	}

	public debug( log: Log | string ): void {
		this.log( log, 'debug' )
	}

	public error( log: Log | string ): void {
		this.log( log, 'error' )
	}

	public fatal( log: Log | string ): void {
		this.log( log, 'error' )
	}

	public info( log: Log | string ): void {
		this.log( log, 'info' )
	}

	public warn( log: Log | string ): void {
		this.log( log, 'warn' )
	}

	public write( level: LogLevel, log: Log | string ): void {
		if ( level === LogLevel.Error || level === LogLevel.Fatal ) {
			this.error( log )
		} else if ( level === LogLevel.Info ) {
			this.info( log )
		} else if ( level === LogLevel.Warn ) {
			this.warn( log )
		} else {
			this.debug( log )
		}
	}
}
