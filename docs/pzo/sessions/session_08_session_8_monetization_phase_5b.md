# Session 8: Monetization Phase 5b

## Overview
This session focuses on completing the monetization phase of the project by implementing and testing the payment gateway integration.

## Prerequisites
* The previous sessions have been completed successfully.
* The payment gateway account has been set up and credentials are available.

## Commands

### Step 1: Configure Payment Gateway Integration

* `git checkout dev`
* `cd /path/to/project`
* `composer require pzo/payment-gateway`
* `cp vendor/pzo/payment-gateway/config.sample.php config/payment-gateway.php`
* `nano config/payment-gateway.php` (update credentials and settings)
* `git add . && git commit -m "Configured payment gateway integration"`

### Step 2: Implement Payment Gateway Integration

* `cd /path/to/project`
* `php artisan vendor:publish --provider=PZO\PaymentGateway\PaymentGatewayServiceProvider`
* `nano app/Providers/PaymentGatewayServiceProvider.php` (update namespace and class name)
* `git add . && git commit -m "Implemented payment gateway integration"`

### Step 3: Test Payment Gateway Integration

* `cd /path/to/project`
* `php artisan db:seed --class=PZO\PaymentGateway\Database\Seeders\PaymentGatewaySeeder`
* `php artisan test:PZO\PaymentGateway\Tests\Feature\PaymentGatewayTest`

## Done Criteria
The payment gateway integration has been successfully implemented and tested.

## Smoke Tests

### Step 1: Verify Payment Gateway Configuration

* `nano config/payment-gateway.php` (verify credentials and settings)
* `git status` (verify changes)

### Step 2: Test Payment Gateway Integration

* `php artisan test:PZO\PaymentGateway\Tests\Feature\PaymentGatewayTest`
* `php artisan db:seed --class=PZO\PaymentGateway\Database\Seeders\PaymentGatewaySeeder`

## Next Steps
The project is now ready for the next phase. Proceed to [Session 9](session_09_session_9_launch_phase.md).
