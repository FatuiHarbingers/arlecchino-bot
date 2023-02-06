import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { BaseError, s } from '@sapphire/shapeshift'
import { EmbedLimits, SnowflakeRegex } from '@sapphire/discord-utilities'
import { ApplyOptions } from '@sapphire/decorators'
import { Fandom } from 'mw.js'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	route: 'register'
} )
export class UserRoute extends Route {
	public async [ methods.POST ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		try {
			const parser = s.object( {
				avatar: s.string.url().optional,
				channel: s.string.regex( SnowflakeRegex ),
				color: s.number.greaterThanOrEqual( 0 ).lessThanOrEqual( 0xffffff ).optional,
				guild: s.string.regex( SnowflakeRegex ),
				name: s.string.lengthGreaterThan( 0 ).lengthLessThanOrEqual( EmbedLimits.MaximumAuthorNameLength ).optional,
				wiki: s.string.regex( /^([a-z-]{2,5}\.)?\w+$/ )
			} ).strict
			const body = parser.parse( request.body )
			Fandom.interwiki2api( body.wiki ) // just to throw an error if the interwiki is wrong
			const configurations = this.container.stores.get( 'models' ).get( 'configurations' )
			const success = await configurations.addWiki( body )
			if ( success ) {
				response.json( {
					message: `"${ body.wiki }" is now being followed by guild ${ body.guild } in channel ${ body.channel }`
				} )
			} else {
				response.status( 400 )
				response.json( {
					message: `Couldn't register "${ body.wiki }" for guild ${ body.guild }. Maybe it has reached its limit, or the wiki was already registered.`
				} )
			}
		} catch ( e ) {
			response.status( 400 )
			if ( e instanceof BaseError ) {
				response.json( {
					message: 'Your request is missing required parameters in its body.'
				} )
				return
			}

			response.json( {
				message: 'There was an error with your request, but we couldn\'t identify the issue.'
			} )
		}
	}
}
