/**
 * game service
 */
import axios from 'axios';
import { JSDOM } from "jsdom";
import { Common, factories } from '@strapi/strapi';
import FormData from 'form-data';
import qs from 'querystring';
import slugify from 'slugify';
import { ProductModel } from './ProductModel';

const gameService: Common.UID.Service = 'api::game.game';
const publisherService: Common.UID.Service = 'api::publisher.publisher';
const developerService: Common.UID.Service = 'api::developer.developer';
const categoryService: Common.UID.Service = 'api::category.category';
const platformService: Common.UID.Service = 'api::platform.platform';

function Exception(e) {
  return { e, data: e.data && e.data.errors && e.data.errors };
}

async function getGameInfo(slug: string){
  try {
    const gogSlug = slug.replaceAll('-', '_').toLowerCase();
    const body = await axios.get(`https://www.gog.com/en/game/${gogSlug}`);
    const dom = new JSDOM(body.data);

    const rawDescription = dom.window.document.querySelector('.description');
    const description = rawDescription.innerHTML;
    const shortDescription = rawDescription.textContent.slice(0, 160);
    const ratingElement = dom.window.document.querySelector('.age-restrictions__icon use');

    return {
      description,
      shortDescription,
      rating: ratingElement ? ratingElement.getAttribute('xlink:href').replace(/_/g, "").replace("#", "") : "BR0"
    }
  }catch(error){
    console.error('getGameInfo: ', Exception(error));
  }
}

async function getByName(name: string, entityService: Common.UID.Service){
  try{
    const item = await strapi.service(entityService).find({
      filters: { name }
    });
    return item.results.length > 0 ? item.results[0] : null;
  }catch(error){
    console.error('getByName: ', Exception(error));
  }
}

async function create(name: string, entityService: Common.UID.Service){
  try{
    const item = await getByName(name, entityService);
    if(!item){
      strapi.service(entityService).create({
        data: {
          name,
          slug: slugify(name, { strict: true, lower: true })
        }
      });
    }
  }catch(error){
    console.error('create: ', Exception(error));
  }
}

async function createManyToManyData(products: ProductModel[]){
  const developersSet = new Set<string>();
  const publishersSet = new Set<string>();
  const categoriesSet = new Set<string>();
  const platformsSet = new Set<string>();

  for(const product of products){
    const { developers, publishers, genres, operatingSystems } = product;
    genres?.forEach(({name}) => categoriesSet.add(name));
    operatingSystems?.forEach((system) => platformsSet.add(system));
    developers?.forEach((developer) => developersSet.add(developer));
    publishers?.forEach((publisher) => publishersSet.add(publisher));
  }

  const createCall = (set: Set<string>, entityName: Common.UID.Service) => Array.from(set).map((name) => create(name, entityName));

  return Promise.all([
    createCall(developersSet, developerService),
    createCall(publishersSet, publisherService),
    createCall(categoriesSet, categoryService),
    createCall(platformsSet, platformService)
  ])
}

async function createGames(products: ProductModel[]) {
  await Promise.all(products.map(async (product) => {
    const item = await getByName(product.title, gameService);

    const categories = await Promise.all(product.genres.map(async({name}) => {
      const category = await getByName(name, categoryService);
      return category;
    }));

    const platforms = await Promise.all(product.operatingSystems.map(async (name) => {
      const platform = await getByName(name, platformService);
      return platform;
    }));

    const developers = await Promise.all(product.developers.map(async (name) => {
      const developer = await getByName(name, developerService);
      return developer;
    }));

    const publisher = await Promise.all(product.publishers.map(async (name) => {
      const publisher = await getByName(name, publisherService);
      return publisher;
    }));

    if(!item) {
      console.info(`Creating: ${product.title}...`);
      const productsData = {
        data: {
          name: product.title,
          slug: product.slug,
          price: product.price?.finalMoney?.amount ?? '0',
          realease_date: new Date(product.releaseDate),
          categories: categories.filter(category => category !== null),
          platforms: platforms.filter(platform => platform !== null),
          developers: developers.filter(developer => developer !== null),
          publisher: publisher.filter(publisher => publisher !== null),
          ...(await getGameInfo(product.slug)),
          publisherAt: new Date()
        }
      };
      try{
        const game = await strapi.service(gameService).create(productsData);

        await setImage({ image: product.coverHorizontal, game });
        await Promise.all(product.screenshots.slice(0, 5).map((url) => setImage({
          image: url.replace('{formatter}', 'product_card_v2_mobile_slider_639'),
          game,
          field: "gallery"
        })));

        return game;
      }catch(error){
        console.error(error);
        console.log(JSON.stringify(productsData));
        throw error;
      }
    }
  }));
}

async function setImage({image, game, field = "cover"}) {
  try {
    const { data } = await axios.get(image, { responseType: "arraybuffer" });
    const buffer = Buffer.from(data, "base64");

    const formData = new FormData();
    formData.append('refId', game.id);
    formData.append('ref', gameService);
    formData.append('field', field);
    formData.append('files', buffer, {filename: `${game.slug}.jpg`});

    console.info(`Uploading ${field} image: ${game.slug}.jpg`);

    await axios.post('http://127.0.0.1:1337/api/upload', formData, {
      headers: {
        ...formData.getHeaders()
      }
    })
  }catch(error){
    console.error('setImage: ', Exception(error))
  }
}

export default factories.createCoreService('api::game.game', () => ({
  async populateService(params){
    try{
      const gogApi = `https://catalog.gog.com/v1/catalog?${qs.stringify(params)}`;

      const {
        data: { products }
      } = await axios.get(gogApi);

      // const productFilter: ProductModel[] = products.filter((product: ProductModel) => product.title === 'Prey');

      await createManyToManyData(products);

      await createGames(products);
    }catch(error){
      console.error('populate: ', Exception(error));
    }
  }
}));
