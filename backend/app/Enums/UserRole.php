<?php

namespace App\Enums;

enum UserRole: string
{
    case ADMIN    = 'admin';
    case FIELD    = 'field';
    case CUSTOMER = 'customer';
}
