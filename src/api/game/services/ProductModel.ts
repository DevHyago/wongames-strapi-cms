export type ProductModel = {
  id: string;
  slug: string;
  features: Array<{
    name: string;
    slug: string;
  }>;
  screenshots: string[];
  releaseDate: string;
  storeReleaseDate: string;
  productType: string;
  title: string;
  coverHorizontal: string;
  coverVertical: string;
  developers: string[];
  publishers: string[];
  operatingSystems: string[];
  price: {
    final: string;
    base: string;
    discount: string;
    finalMoney: {
      amount: string;
      currency: string;
      discount: string;
    },
    baseMoney: {
      amount: string;
      currency: string;
    }
  }
  productState: string;
  genres: Array<{
    name: string;
    slug: string;
  }>;
  tags: Array<{
    name: string;
    slug: string;
  }>;
  ratings: Array<{
    name: string;
    ageRating: string;
  }>;
  storeLink: string;
}
