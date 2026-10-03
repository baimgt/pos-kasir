import mongoose from 'mongoose'
import QRCode from 'qrcode'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// Load environment variables from .env.local natively without external dependencies
try {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim()
        const val = trimmed.slice(idx + 1).trim()
        if (!process.env[key]) process.env[key] = val
      }
    }
  }
} catch (e) {
  // ignore
}

import User from '../models/User'
import Category from '../models/Category'
import Product from '../models/Product'
import Table from '../models/Table'
import Settings from '../models/Settings'
import StockMovement from '../models/StockMovement'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pos-kasir'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function generateQRToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

async function seed() {
  console.log('🌱 Memulai proses seeding database POS Kasir...')
  console.log(`🔌 Menghubungkan ke MongoDB: ${MONGODB_URI}`)

  try {
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Berhasil terhubung ke MongoDB')

    // 1. CLEAR EXISTING DATA (Optional: Clean slate)
    console.log('🧹 Membersihkan data lama...')
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Product.deleteMany({}),
      Table.deleteMany({}),
      Settings.deleteMany({}),
      StockMovement.deleteMany({}),
    ])

    // 2. SEED USERS
    console.log('👤 Membuat akun default...')
    const admin = await User.create({
      name: 'Super Admin',
      email: 'admin@poskasir.com',
      password: 'admin123',
      role: 'ADMIN',
      isActive: true,
    })

    const cashier = await User.create({
      name: 'Kasir Utama',
      email: 'kasir@poskasir.com',
      password: 'kasir123',
      role: 'CASHIER',
      isActive: true,
    })

    const chef = await User.create({
      name: 'Koki Dapur',
      email: 'koki@poskasir.com',
      password: 'koki123',
      role: 'KITCHEN',
      isActive: true,
    })
    console.log('   - Admin: admin@poskasir.com / admin123')
    console.log('   - Kasir: kasir@poskasir.com / kasir123')
    console.log('   - Koki: koki@poskasir.com / koki123')

    // 3. SEED SETTINGS
    console.log('⚙️ Membuat pengaturan restoran default...')
    await Settings.create({
      storeName: 'Restoran Rasa Nusantara',
      storeAddress: 'Jl. Malioboro No. 88, Yogyakarta',
      storePhone: '0812-3456-7890',
      storeEmail: 'kontak@rasanusantara.id',
      receiptFooter: 'Terima kasih atas kunjungan Anda!\nFollow Instagram kami @rasanusantara.id\nWiFi: Nusantara-Guest / Pass: enaktenan',
      taxEnabled: true,
      taxPercentage: 11,
      discountEnabled: true,
      currency: 'IDR',
      currencySymbol: 'Rp',
      cashPaymentEnabled: true,
      midtransEnabled: true,
      qrOrderingEnabled: true,
      qrAllowCashPayment: true,
      qrAllowMidtransPayment: true,
    })

    // 4. SEED CATEGORIES
    console.log('🏷️ Membuat kategori menu...')
    const categoriesData = [
      {
        name: 'Makanan Utama',
        slug: 'makanan-utama',
        description: 'Menu hidangan utama khas nusantara yang lezat dan mengenyangkan',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
      {
        name: 'Minuman Segar',
        slug: 'minuman-segar',
        description: 'Aneka jus buah, es teh, dan minuman pelepas dahaga',
        image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
      {
        name: 'Kopi & Teh',
        slug: 'kopi-teh',
        description: 'Kopi arabika, robusta, matcha, dan racikan teh premium',
        image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
      {
        name: 'Cemilan & Snack',
        slug: 'cemilan-snack',
        description: 'Cemilan gurih dan manis pendamping nongkrong santai',
        image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
      {
        name: 'Paket Hemat',
        slug: 'paket-hemat',
        description: 'Kombinasi makanan + minuman dengan harga lebih ekonomis',
        image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
    ]

    const categories = await Category.insertMany(categoriesData)
    const catMap = new Map(categories.map((c) => [c.slug, c._id]))

    // 5. SEED PRODUCTS
    console.log('🍲 Membuat produk & menu restoran...')
    const productsData = [
      // Makanan Utama
      {
        name: 'Nasi Goreng Spesial Nusantara',
        slug: 'nasi-goreng-spesial-nusantara',
        sku: 'MKN-001',
        description: 'Nasi goreng dengan bumbu rempah pilihan, telur mata sapi, ayam suwir, dan kerupuk udang.',
        price: 32000,
        costPrice: 15000,
        stock: 50,
        minimumStock: 10,
        categoryId: catMap.get('makanan-utama'),
        image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
      {
        name: 'Ayam Bakar Madu',
        slug: 'ayam-bakar-madu',
        sku: 'MKN-002',
        description: 'Ayam kampung bakar dengan olesan madu murni, disajikan dengan sambal terasi dan lalapan segar.',
        price: 38000,
        costPrice: 20000,
        stock: 40,
        minimumStock: 8,
        categoryId: catMap.get('makanan-utama'),
        image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
      {
        name: 'Sate Ayam Madura (10 Tusuk)',
        slug: 'sate-ayam-madura-10-tusuk',
        sku: 'MKN-003',
        description: 'Sate daging ayam empuk dengan saus kacang legit, kecap manis, dan potongan lontong.',
        price: 35000,
        costPrice: 18000,
        stock: 45,
        minimumStock: 10,
        categoryId: catMap.get('makanan-utama'),
        image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
      {
        name: 'Mie Goreng Seafood Spesial',
        slug: 'mie-goreng-seafood-spesial',
        sku: 'MKN-004',
        description: 'Mie telur kenyal ditumis dengan udang segar, cumi, bakso ikan, dan sayuran renyah.',
        price: 34000,
        costPrice: 16000,
        stock: 35,
        minimumStock: 8,
        categoryId: catMap.get('makanan-utama'),
        image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
      {
        name: 'Rendang Sapi Minang',
        slug: 'rendang-sapi-minang',
        sku: 'MKN-005',
        description: 'Daging sapi empuk yang dimasak perlahan dengan santan dan rempah tradisional Minangkabau.',
        price: 45000,
        costPrice: 28000,
        stock: 30,
        minimumStock: 5,
        categoryId: catMap.get('makanan-utama'),
        image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },

      // Minuman Segar
      {
        name: 'Es Teh Manis Jumbo',
        slug: 'es-teh-manis-jumbo',
        sku: 'MNM-001',
        description: 'Teh melati seduh segar dengan gula asli dan es batu melimpah.',
        price: 8000,
        costPrice: 2000,
        stock: 200,
        minimumStock: 25,
        categoryId: catMap.get('minuman-segar'),
        image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
      {
        name: 'Es Jeruk Peras Murni',
        slug: 'es-jeruk-peras-murni',
        sku: 'MNM-002',
        description: 'Jeruk peras segar manis alami kaya vitamin C.',
        price: 14000,
        costPrice: 5000,
        stock: 80,
        minimumStock: 15,
        categoryId: catMap.get('minuman-segar'),
        image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
      {
        name: 'Jus Alpukat Kocok Cokelat',
        slug: 'jus-alpukat-kocok-cokelat',
        sku: 'MNM-003',
        description: 'Alpukat mentega kental dengan saus cokelat premium dan susu kental manis.',
        price: 22000,
        costPrice: 10000,
        stock: 50,
        minimumStock: 10,
        categoryId: catMap.get('minuman-segar'),
        image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },

      // Kopi & Teh
      {
        name: 'Kopi Susu Gula Aren',
        slug: 'kopi-susu-gula-aren',
        sku: 'KOP-001',
        description: 'Espresso blend pilihan dengan susu segar dan sirup gula aren organik asli.',
        price: 20000,
        costPrice: 8000,
        stock: 120,
        minimumStock: 20,
        categoryId: catMap.get('kopi-teh'),
        image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
      {
        name: 'Matcha Green Tea Latte',
        slug: 'matcha-green-tea-latte',
        sku: 'KOP-002',
        description: 'Pure Japanese matcha green tea dipadukan dengan steamed fresh milk.',
        price: 24000,
        costPrice: 11000,
        stock: 60,
        minimumStock: 10,
        categoryId: catMap.get('kopi-teh'),
        image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },

      // Cemilan
      {
        name: 'Pisang Goreng Keju Cokelat',
        slug: 'pisang-goreng-keju-cokelat',
        sku: 'SNK-001',
        description: 'Pisang raja goreng krispi ditaburi keju cheddar melimpah dan meses cokelat.',
        price: 18000,
        costPrice: 7000,
        stock: 60,
        minimumStock: 10,
        categoryId: catMap.get('cemilan-snack'),
        image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
      {
        name: 'Tahu Crispy Cabai Garam',
        slug: 'tahu-crispy-cabai-garam',
        sku: 'SNK-002',
        description: 'Tahu sutra renyah digoreng gurih ditumis dengan irisan cabai rawit dan bawang putih wangi.',
        price: 16000,
        costPrice: 6000,
        stock: 55,
        minimumStock: 10,
        categoryId: catMap.get('cemilan-snack'),
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
      {
        name: 'Kentang Goreng French Fries',
        slug: 'kentang-goreng-french-fries',
        sku: 'SNK-003',
        description: 'Kentang renyah disajikan dengan cocolan saus tomat dan saus sambal.',
        price: 18000,
        costPrice: 7000,
        stock: 70,
        minimumStock: 15,
        categoryId: catMap.get('cemilan-snack'),
        image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },

      // Paket Hemat
      {
        name: 'Paket Hemat Ayam Bakar + Es Teh',
        slug: 'paket-hemat-ayam-bakar-es-teh',
        sku: 'PKT-001',
        description: 'Hemat 10%! Nasi putih pulen, ayam bakar madu 1 potong, sambal, lalapan, dan Es Teh Jumbo.',
        price: 42000,
        costPrice: 22000,
        stock: 40,
        minimumStock: 10,
        categoryId: catMap.get('paket-hemat'),
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
      {
        name: 'Paket Nasi Goreng + Kopi Susu',
        slug: 'paket-nasi-goreng-kopi-susu',
        sku: 'PKT-002',
        description: 'Pilihan pas untuk makan siang/malam: Nasi Goreng Spesial dan segelas Kopi Susu Gula Aren.',
        price: 46000,
        costPrice: 23000,
        stock: 35,
        minimumStock: 8,
        categoryId: catMap.get('paket-hemat'),
        image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&auto=format&fit=crop&q=60',
        isActive: true,
      },
    ]

    const products = await Product.insertMany(productsData)

    // Initial stock movements log
    const stockMovements = products.map((p) => ({
      productId: p._id,
      productName: p.name,
      type: 'RESTOCK' as const,
      quantity: p.stock,
      previousStock: 0,
      newStock: p.stock,
      notes: 'Initial seed stock',
      userId: admin._id,
      userName: admin.name,
    }))
    await StockMovement.insertMany(stockMovements)

    // 6. SEED RESTAURANT TABLES & QR CODES
    console.log('🪑 Membuat data meja & QR Code pemesanan...')
    const tablesData = [
      { tableNumber: '01', name: 'Meja 01 - Indoor AC' },
      { tableNumber: '02', name: 'Meja 02 - Indoor AC' },
      { tableNumber: '03', name: 'Meja 03 - Dekat Jendela' },
      { tableNumber: '04', name: 'Meja 04 - Dekat Jendela' },
      { tableNumber: '05', name: 'Meja 05 - Sofa Tengah' },
      { tableNumber: '06', name: 'Meja 06 - Sofa Tengah' },
      { tableNumber: '07', name: 'Meja 07 - Outdoor Garden' },
      { tableNumber: '08', name: 'Meja 08 - Outdoor Garden' },
      { tableNumber: 'VIP', name: 'Meja VIP - Ruang Rapat' },
    ]

    for (const t of tablesData) {
      const qrToken = generateQRToken()
      const qrUrl = `${APP_URL}/order/${qrToken}`
      const qrCode = await QRCode.toDataURL(qrUrl, {
        width: 350,
        margin: 2,
        color: { dark: '#1e1b4b', light: '#ffffff' },
      })

      await Table.create({
        tableNumber: t.tableNumber,
        name: t.name,
        qrToken,
        qrCode,
        isActive: true,
      })
    }

    console.log('\n========================================')
    console.log('🎉 PROSES SEEDING SELESAI DENGAN SUKSES!')
    console.log('========================================')
    console.log(`✅ 2 Pengguna dibuat:`)
    console.log(`   - ADMIN : admin@poskasir.com (pass: admin123)`)
    console.log(`   - KASIR : kasir@poskasir.com (pass: kasir123)`)
    console.log(`✅ ${categories.length} Kategori dibuat`)
    console.log(`✅ ${products.length} Produk menu lengkap dengan stok`)
    console.log(`✅ ${tablesData.length} Meja restoran dengan QR Code unik`)
    console.log(`✅ Pengaturan restoran dan pajak PPN 11% tersimpan`)
    console.log('========================================\n')

    process.exit(0)
  } catch (error) {
    console.error('❌ Gagal menjalankan seed:', error)
    process.exit(1)
  }
}

seed()
