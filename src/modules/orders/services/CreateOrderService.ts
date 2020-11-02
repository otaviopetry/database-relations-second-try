import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const findCustomer = await this.customersRepository.findById(customer_id);

    if (!findCustomer) {
      throw new AppError('Customer not found!');
    }

    const findAllProducts = await this.productsRepository.findAllById(products);

    if (findAllProducts.length < products.length) {
      throw new AppError('There is at least one non-existent product');
    }

    const productWithInsuficientQuantity = products.some(product => {
      const find = findAllProducts.find(
        findedProduct =>
          findedProduct.id === product.id &&
          findedProduct.quantity < product.quantity,
      );

      if (find) {
        return true;
      }
      return false;
    });

    if (productWithInsuficientQuantity) {
      throw new AppError(
        'There is at least one product with insufficient quantity',
      );
    }

    const formattedProducts = findAllProducts.map(persistedProduct => {
      return {
        product_id: persistedProduct.id,
        price: persistedProduct.price,
        quantity: products.filter(
          product => persistedProduct.id === product.id,
        )[0].quantity,
      };
    });

    const updateProducts = products.map(product => {
      return {
        id: product.id,
        quantity: product.quantity,
      };
    });

    await this.productsRepository.updateQuantity(updateProducts);

    const order = await this.ordersRepository.create({
      customer: findCustomer,
      products: formattedProducts,
    });

    console.log(order);

    return order;
  }
}

export default CreateOrderService;
