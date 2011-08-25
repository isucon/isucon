#!/usr/bin/env perl

use strict;
use warnings;
use List::Util qw/shuffle/;
use Digest::MD5;
use JSON;
use Furl;

my @urls = map { ([@{$_},0],[@{$_},1] )  } (
  ['/css/jquery-ui-1.8.14.custom.css','842e5fa9a9e51ccd3941cf41431953a7'],
  ['/css/isucon.css','6b0f4fff688009a22f78eb64e4a7b77f'],
  ['/js/jquery-1.6.2.min.js','a1a8cb16a060f6280a767187fd22e037'],
  ['/js/jquery-ui-1.8.14.custom.min.js','0908b7c14f59c2d623dc155b9986b7d5'],
  ['/js/isucon.js','d41d8cd98f00b204e9800998ecf8427e'],
  ['/images/isucon_title.jpg','f4e250d855a493eb637177c4959b9abc'],
);

my $base_url = $ARGV[0];
if (!$base_url) {
    print "usage: $0 base_url\n";
    exit;
}

$base_url =~ s!/$!!;

my %error;
for my $url ( shuffle @urls )  {
    my $furl = Furl->new(
        connection_header => "close",
        agent => 'http_load 12mar2006',
    );
    my @header;
    push @header, 'Accept-Encoding', 'gzip, deflate' if $url->[2];
    my $res = $furl->get( $base_url.$url->[0], \@header );
    if ( $res->code != 200 ) {
        $error{$url->[0]} = $res->status_line;
        next;
    }
    my $body =  $res->content;
    if ( Digest::MD5::md5_hex($body) ne $url->[1] ) {
        $error{$url->[0]} = 'checksum not much';
    }
}

my %summary;
$summary{summary} = ( keys %error ) ? 'fail' : 'success';
$summary{errors} = \%error if keys %error;

print JSON->new->pretty->encode(\%summary);


