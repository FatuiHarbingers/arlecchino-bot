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

	public async addWiki( options: IConfiguration ): Promise<void> {
		const guilds = this.container.stores.get( 'models' ).get( 'guilds' )
		const guildLimit = await guilds.getLimit( options.guild )
		const currentCount = await this.countGuildConfigurations( options.guild )
		if ( currentCount >= guildLimit ) throw new Error( 'Guild is already on the maximum number of wikis it can follow.' )

		const alreadyExists = await this.model.findOne( {
			where: {
				guild: options.guild,
				wiki: options.wiki
			}
		} )
		if ( alreadyExists ) throw new Error( 'Wiki is already being followed.' )

		await this.model.create( options )
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

	public async update( options: Partial<IConfiguration> & Pick<IConfiguration, 'guild' | 'wiki'> ): Promise<void> {
		const { guild, wiki } = options
		await this.model.update(
			options,
			{ where: { guild, wiki } }
		)
	}

	public async delete( options: Pick<IConfiguration, 'guild' | 'wiki'> ): Promise<void> {
		await this.model.destroy( {
			where: options
		} )
	}
}

declare global {
	interface ModelRegistryEntries {
		configurations: ConfigurationModel
	}
}
