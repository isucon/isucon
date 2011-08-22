#!/usr/bin/env perl

use FindBin;
use lib "$FindBin::Bin/extlib/lib/perl5";
use lib "$FindBin::Bin/lib";
use Isucon;

Isucon->psgi();
