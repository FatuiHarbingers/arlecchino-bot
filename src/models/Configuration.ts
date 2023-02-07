import type { ModelStatic, Model as SequelizeModel } from 'sequelize'
import type { PieceContext, PieceOptions } from '@sapphire/pieces'
import { DataTypes } from 'sequelize'
import { Model } from '../framework'

export interface IConfiguration {
	avatar?: string
	channel: string
	color?: number
	guild: string
	name?: string
	wiki: string
}

interface IConfigurationInterface extends SequelizeModel<IConfiguration, IConfiguration>, IConfiguration {
}

export class ConfigurationModel extends Model<IConfigurationInterface> {
	public readonly model: ModelStatic<IConfigurationInterface>

	public constructor( context: PieceContext, options: PieceOptions ) {
		super( context, {
			...options,
			name: 'configurations'
		} )

		this.model = this.container.sequelize.define<IConfigurationInterface>(
			'Configuration',
			{
				avatar: {
					allowNull: true,
					type: DataTypes.STRING
				},
				channel: {
					allowNull: false,
					type: DataTypes.STRING
				},
				color: {
					defaultValue: 0x00acc1,
					type: DataTypes.INTEGER
				},
				guild: {
					primaryKey: true,
					type: DataTypes.STRING
				},
				name: {
					allowNull: true,
					type: DataTypes.STRING
				},
				wiki: {
					primaryKey: true,
					type: DataTypes.STRING
				}
			},
			{
				tableName: 'Configurations',
				timestamps: false
			}
		)
	}

	public async addWiki( options: IConfiguration ): Promise<boolean> {
		const guilds = this.container.stores.get( 'models' ).get( 'guilds' )
		const guildLimit = await guilds.getLimit( options.guild )
		const currentCount = await this.countGuildConfigurations( options.guild )
		if ( currentCount >= guildLimit ) return false

		const alreadyExists = await this.model.findOne( {
			where: {
				guild: options.guild,
				wiki: options.wiki
			}
		} )
		if ( alreadyExists ) return false

		await this.model.create( options )
		return true
	}

	public async countGuildConfigurations( guild: string ): Promise<number> {
		const items = await this.getGuildConfigurations( guild )
		return items.length
	}

	public getGuildConfigurations( guild: string ): Promise<IConfiguration[]> {
		return this.model.findAll( { where: { guild } } )
	}

	public getWikiGuilds( wiki: string ): Promise<IConfiguration[]> {
		return this.model.findAll( { where: { wiki } } )
	}

	public async getWikis(): Promise<Set<string>> {
		const res = await this.model.findAll( {
			attributes: [ 'wiki' ],
			group: [ 'wiki' ]
		} )
		const wikis = res.map( i => i.wiki )
		return new Set( wikis )
	}

	public setProperty( guild: string, wiki: string, property: 'avatar' | 'color' | 'name', value: string | number ): Promise<[ number ]> {
		return this.model.update(
			{ [ property ]: value },
			{ where: { guild, wiki } }
		)
	}
}

declare global {
	interface ModelRegistryEntries {
		configurations: ConfigurationModel
	}
}
